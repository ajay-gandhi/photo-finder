'use strict';

// NPM modules
var Facebook = require('facebook-node-sdk'),
    express  = require('express'),
    session  = require('express-session'),
    Promise  = require('es6-promise').Promise,
    request  = require('request'),
    qs       = require('querystring');

// Local modules
var config = require('./config.json');

/*********************************** Server ***********************************/

var app        = express(),
    fb_objects = {};

// Sessions for maintaining FB objects
app.use(session({
  secret:            'session secret',
  resave:            false,
  saveUninitialized: false
}));

app.use(express.static(__dirname + '/html'));

app.get('/token', function (req, res) {

  var sesh = req.session;

  // Make a call to FB API to get a long-lived token
  // Can't use FB.api because we need to pass special params
  var longTokenURL = 'https://graph.facebook.com/oauth/access_token?' +
    'grant_type=fb_exchange_token' +
    '&client_id=' + config.appID +
    '&client_secret=' + config.secret +
    '&fb_exchange_token=' + req.query.accessToken;

  request(longTokenURL, function(err, resp, body) {
    if (err) {
      res.send(false);
      return console.error('Error getting long-lived token.', err);
    }

    req.session.authd = true;

    // Store fb module in session
    fb_objects[req.sessionID] = new Facebook({
      appID:  config.appID,
      secret: config.secret
    }).setAccessToken(qs.parse(body).access_token);

    res.send(true);
  });
});

app.get('/photos', function (req, res) {
  // Fail if not authorized
  if (!req.session.authd) {
    res.send(JSON.stringify({
      success: false,
      auth:    false
    }));
    return;
  }

  var fb = fb_objects[req.sessionID];
  evaluate_pics(fb, req.query.word, '/me/photos')
    // Send urls of pics
    .then(function (urls) {
      res.send(JSON.stringify({
        success: true,
        auth:    true,
        urls:    urls
      }));
    })
    .catch(function (e) {
      console.trace(e);
      res.send(JSON.stringify({
        success: false,
        auth:    true
      }));
    });
});

var port = 3000;
app.listen(port, function () {
  console.log('Listening on port', port);
});

/******************************** FB Functions ********************************/

/**
 * Evaluates all the pics the user is tagged in. Basically check if the comments
 *   contain synonyms of the given word.
 */
var evaluate_pics = function (fb, word, edge) {
  return new Promise(function (resolve, reject) {

    // Request photos
    fb.api(edge, function (err, res) {
      if (err) {
        reject(err);
        return;
      }

      var syns;

      // Get synonyms
      synonyms(word)
        .then(function (s) {
          syns = s.filter(function (w) { return (w.length > 3); });

          // Get all FB pics
          return get_all_pics(fb, '/me/photos');
        })

        // Continue only when all pics are filtered
        .then(function (pics) {
          return Promise.all(pics.map(comments_contain_map(fb, syns), []))
        })

        // Remove false
        .then(function (pics) {
          return pics.filter(function (v) { return !(v == false); })
        })

        // Convert image IDs to actual image link
        .then(function (ids) {
          return Promise.all(ids.map(id_to_image_map(fb)));
        })

        .then(resolve);
    });
  });
}

/**
 * Recursively retrieves all photos the user is tagged in
 */
var get_all_pics = function (fb, edge) {
  return new Promise(function (resolve, reject) {
    fb.api(edge, function (err, res) {
      if (err) return console.trace('Error retrieving photos:', err);

      // If paging, recurse
      if (res.paging.next) {
        get_all_pics(fb, res.paging.next)
          .then(function (next_pics) {
            resolve(res.data.concat(next_pics));
          });

      // Otherwise just return these words
      } else {
        resolve(res.data);
      }
    });
  });
}

/**************************** Getting actual images ***************************/

/**
 * Returns a function to be used in .map()
 *   The function maps each image id to its link
 *
 * @param [Facebook] fb - A Facebook API object
 *
 * @returns [Promise] Resolves to pic link.
 */
var id_to_image_map = function (fb) {
  return function (id) {
    return new Promise(function (resolve, reject) {
      fb.api('/' + id + '?fields=picture', function (err, res) {
        resolve(res.picture);
      });
    });
  }
}

/****************************** Getting comments ******************************/

/**
 * Returns a function to be used in .map()
 *   The function maps each image to its id if its comments contain syns,
 *   otherwise false
 *
 * @param [Facebook] fb   - A Facebook API object
 * @param [Array]    syns - A list of synonyms to check
 *
 * @returns [Promise] Resolves to pic id or false.
 */
var comments_contain_map = function (fb, syns) {
  return function (pic) {
    return get_all_comments(fb, pic.id)
      .then(function (all_words) {
        if (pic.name) all_words += ' ' + pic.name;

        // Check if all_words contains any syn
        var has = syns.some(function (syn) {
          return (all_words.indexOf(syn) >= 0);
        });

        return has ? pic.id : false;
      });
  }
}

/**
 * Recursively retrieve all comments as a long string.
 */
var get_all_comments = function (fb, pic_id) {
  return new Promise(function (resolve, reject) {
    // Get comments of pic
    fb.api('/' + pic_id + '/comments', function (err, res) {
      // No comments on this pic
      if (res.data.length == 0) {
        resolve('');
        return;
      }

      // Consolidate all comments
      var words = res.data.reduce(function (str, curr) {
        return str + ' ' + curr.message.toLowerCase();
      }, '');

      // If paging, recurse
      if (res.paging.next) {
        get_all_comments(fb, res.paging.next)
          .then(function (next_words) {
            resolve(words + ' ' + next_words);
          });

      // Otherwise just return these words
      } else {
        resolve(words);
      }
    });
  });
}

/* Synonyms */

/**
 * Fetches synonyms from the Wordnik API
 */
var synonyms = function (word) {
  return new Promise(function (resolve, reject) {
    var options = {
      url: 'http://api.wordnik.com:80/v4/word.json/' + word + '/relatedWords',
      qs: {
        useCanonical: false,
        limitPerRelationshipType: 50,
        api_key: config.wordnik
      }
    }

    request(options, function (err, resp, body) {
      body = JSON.parse(body);

      resolve(body.reduce(function (acc, curr) {
        return (curr.relationshipType === 'equivalent' ||
          curr.relationshipType === 'synonym') ?
          acc.concat(curr.words) :
          acc;
      }, []));
    });
  });
}

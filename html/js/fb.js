// Logs into FB, fetches tokens
$(document).ready(function() {
  var waiting = false;

  //////////////////////// Click events, form submission ///////////////////////

  // Login to FB
  $('#login-button').click(function() {
    FB.login(function(response) {
      location.reload();
    }, { scope: 'user_photos' });
  });

  // Search
  $('input').keypress(function (e) {
    if (e.which == 13) {
      search();
      return false;
    }
  });
  $('button#search-button').click(function () {
    search();
  });

  var search = function () {
    // Do nothing if waiting for response
    if (!waiting) {
      waiting = true;
      $('button#search-button').prop('disabled', true);

      // AJAX request for pics
      $.get('photos', { word: $('input').val() }, function (result) {
        waiting = false;
        $('button#search-button').prop('disabled', false);

        res = JSON.parse(result);
        // Something failed
        if (!res.success) {
          if (!res.auth) $('#status').text('Error authenticating.');
          else           $('#status').text('Error fetching images.');
          return;
        }

        $('div#photos').html('');
        $.each(res.urls, function (i, url) {
          $('div#photos').append('<img src="' + url + '" />');
        });
      });
    }
  }

  ////////////////////////////// Initial FB things /////////////////////////////
  function statusChangeCallback(response) {
    if (response.status === 'connected') {
      // Logged into your app and Facebook.
      $.get('token', response.authResponse, function (data) {
        // Failed
        if (!data) {
          $('#status').text('Error authenticating. Try logging in again?');
          return;
        }

        // Hide login, show search
        $('div#facebook-login-form').fadeOut('fast', function () {
          $('div#search-form').fadeIn('fast');
        });
      });

    } else if (response.status === 'not_authorized') {
      // The person is logged into Facebook, but not your app.
      $('h4#status').text('Please log into this app and refresh.');
    } else {
      // The person is not logged into Facebook
      $('h4#status').text('Please log into Facebook and refresh.');
    }
  }

  // Load the FB SDK asynchronously
  window.fbAsyncInit = function() {
    FB.init({
      appId   : '1489522808035310',
      cookie  : false,
      xfbml   : false,
      version : 'v2.4'
    });

    FB.getLoginStatus(function(response) {
      statusChangeCallback(response);
    });
  };

  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = 'http://connect.facebook.net/en_US/sdk.js';
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
});

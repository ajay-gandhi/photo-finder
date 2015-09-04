# Photo Finder

> Search Facebook photos by keyword

By analyzing each photo's comments and description, this app returns photos that
hopefully are relevant to the entered keyword.

## Running

Clone the repo and install dependencies:

```bash
$ git clone https://github.com/ajay-gandhi/photo-finder.git
$ cd photo-finder/
$ npm install
```

Create a file called `config.json` and fill it with your Facebook app
credentials and Wordnik API key:

```json
{
  "appID": [fb app id], 
  "secret": [fb app secret],
  "wordnik": [wordnik api key]
}
```

Also, in `js/fb.js`, replace this will your FB app id:

```js
// Load the FB SDK asynchronously
window.fbAsyncInit = function() {
  FB.init({
    appId   : '1489522808035310', // Replace this
    cookie  : false,
    xfbml   : false,
    version : 'v2.4'
  });

  FB.getLoginStatus(function(response) {
    statusChangeCallback(response);
  });
};
```

Now you're ready, just run `server.js`:

```bash
$ node server.js
```

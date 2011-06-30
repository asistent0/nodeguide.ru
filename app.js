// Modules
var express = require('express')
  , path = require('path')
  , sm = require('sitemap')
  , fs = require('fs');

// Documentation base path
var doc_base = path.join(__dirname, 'build', 'json');

// Documentation environment
// (read from file that builded by sphinx)
var env;
fs.readFile(path.join(doc_base, 'globalcontext.json'), 'utf8', function (err, data) {
    env = JSON.parse(data);
});

// Application configuration
var app = module.exports = express.createServer();
app.configure( function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.logger());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

// Route middleware
function handleTrailSlash(req, res, next) {
  if ( req.url[req.url.length - 1] !== '/' &&   // no trailing slash
       req.url.indexOf('/index') === -1 ) {     // this is not a section index page
    res.redirect( req.url + '/' )
  } else {
    next();
  }
}

// Sitemap
var sitemap = sm.createSitemap({hostname: 'http://nodeguide.ru/doc'});
app.get('/sitemap.xml', function (req, res) {
  var cdir = process.cwd();
  res.header('Content-Type', 'application/xml');

  // some type of cache
  if ( sitemap.urls.length ) {
    res.send(sitemap.toXML());
    return;
  }
  // fill sitemap
  else {
    // add index page
    sitemap.add({ url: '/', safe: true, priority: 1, changefreq: 'dayly' });
    // add other pages
    walk(cdir+'/guides', function(files) {
        files.forEach( function (file) {
          if (!file || file.indexOf('.rst') == -1) { return; }
          // delete some stuff
          var clear_url = file.replace(cdir, '')
                              .replace('.rst', '')
                              .replace('guides/', '');
          // trailing slash fix
          if (  clear_url[clear_url.length -1 ] != '/' &&
                clear_url.indexOf('index') == -1 ) {
            clear_url += '/';
          }
          sitemap.add({
            url: clear_url, safe: true,
            priority: (clear_url.indexOf('index') == -1) ? 0.5 : 0.8
          });
        })
        res.send( sitemap.toXML() );
    });
  }
});

// Routes

app.get('/', function (req, res) { res.redirect('/doc/'); });
app.get(/doc$/, function (req, res) { res.redirect('/doc/'); });
app.get(/doc\/([\w-\/]*)?$/, handleTrailSlash, function (req, res, next) {
    var url = req.params[0],
        port = app.address().port,
        // url point to file
        doc_name = (url ? url.replace(/\/$/,'') : 'index') + '.fjson',
        filename = path.join(doc_base, doc_name);

    //console.log(' * filename #1: ' + filename);

    path.exists(filename, function(exists) {
        // found
        if (exists) {
            fs.readFile(filename, 'utf8', function (err, data) {
                res.render('layout', { doc: JSON.parse(data),
                                        env: env, port: port});
            });
            return;
        }

        // may be it was directory?
        // add index.fjson
        filename = path.join(doc_base, url, 'index.fjson');
        //console.log(' * filename #2: ' + filename);
        path.exists(filename, function (exists) {
            if (!exists) {
                res.send(404);
                return;
            }

            fs.readFile(filename, 'utf8', function (err, data) {
                res.render('layout', { doc: JSON.parse(data),
                                        env: env, port: port});
            });
        });
    });
});

// Only listen on $ node app.js
if (!module.parent) {
    app.listen(3000);
    console.log("Express server listening on port %d", app.address().port);
}

// Utils
var walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err || !list) return done(results);
    (function next(i) {
      var f = list[i];
      if (!f) return done(results);
      fs.stat(dir + '/' + f, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(dir + '/' + f, function(r) {
            results = results.concat(r);
            next(++i);
          });
        } else {
          results.push(dir + '/' + f);
          next(++i);
        }
      });
    })(0);
  });
};

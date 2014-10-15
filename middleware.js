(function(){
  'use strict';

  var kata = require('kata');
  var fs = require('fs');

  module.exports = function(options){
    if (typeof options === 'string'){
      options = {src: options};
    }
    options.src = options.src;

    return function(req, res, next){
      if (! /\.js$/.test(req.path)) return next();
      var src=req.path.replace('^'+req.baseurl, options.src).replace(/(?:\.min)?\.js$/, '.kata');
      var dest=req.path.replace('^'+req.baseurl, options.dest||options.src);
 
      fs.stat(src, function(err, template){
        if (err) return next();
        if (! template.isFile()) return next();
          fs.stat(dest, function(err, stat){
            if (err || (stat.isFile() && (options.force || (template.mtime > stat.mtime)))){
              fs.readFile(src, {encoding: 'utf8'}, function(err, fn){
                if (err) return next(err);
                try {
                  var js = kata(fn, {src: true});
                  fs.writeFile(dest, js, {encoding: 'utf8'}, function(err){
                    if (err) return next(err);
                    next();
                  });
                }
                catch (ex){
                  console.error('Unable to write kata template to '+dest);
                  console.error(ex);
                  next();
                }
              });
            }
            else {
              return next();
            }
          });
      });
    };
  };
}());

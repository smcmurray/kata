(function(definition){
  'use strict';

  if (typeof module != 'undefined') {
    module.exports = definition(require);
  }
  else if (typeof define == 'function' && typeof define.amd == 'object') {
    define(definition);
  }
  else throw new Error('Kata requires a module loader. Please use a CommonJS or AMD module loader.');
}(function(require) {

  var compiler = require('./parser.min');

  return Object.create(Object.prototype, {
    compile: {
      value: function(src, options){
        var defaults = {
          browser: true
        };
        var opts = Object.keys(defaults).reduce(function(o,k){
          if (options && options[k]) o[k] = options[k];
          else o[k] = defaults[k];
          return o;
        }, {});

        var res;
        try {
          res = compiler.parse(src);
        }
        catch(ex){
          throw new Error(compiler.SyntaxError);
        }
        return "(function(name, definition){"
          + "'use strict';"
          + "if (typeof module != 'undefined') module.exports = definition();"
          + "else if (typeof define == 'function' && typeof define.amd == 'object') define(definition);"
          + "else this[name] = definition();"
          + "}('root'," + res + "));"
      }
    }
  });
}));

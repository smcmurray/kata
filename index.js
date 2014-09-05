(function(){
  'use strict';

  var compiler = require('./parser');
  
  module.exports = Object.create(Object.prototype, {
    compile: {
      value: function(src, options){
        return compiler.parse(src);
      }
    }
  });
}());

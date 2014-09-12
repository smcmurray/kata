(function(){
  'use strict';

  var blk = {};

  blk['%'] = function(str){
    var match, re=/^\s*(\w+)/g;
    var pos = 0, name, args;

    if (match=re.exec(str)){
      name = match[1];
      pos += re.lastIndex;
      str = str.substr(re.lastIndex);
    }

    if (!(match = parenthetical(str))) return new Error('Template block missing arguments');
    args = match.value;
    pos += match.pos;
    str = str.substr(match.pos);

    return '» function ' + (name ? name : '') + args + "{var out='';«" + str + "»}«";
  };

  blk['='] = function(str){
    return '» out += ' + str + '; «';
  };

  blk['@'] = function(str){
    var match, iter, args;

    if (!(match = parenthetical(str))) throw new Error('Iterate block missing iterable');
    iter = match.value;
    str = str.substr(match.pos);
    if (!(match = parenthetical(str))) throw new Error('Iterate block missing arguments');
    args = match.value;
    str = str.substr(match.pos);
    return '»'+iter+'.forEach(function'+args+'{«'
      + str
      + '»});«';
  };

  blk['?'] = function(str){
    var match, cond;

    if (!(match = parenthetical(str))) throw new Error('Condition block missing condition');
    cond = match.value;
    str = str.substr(match.pos);
    return '»if '+cond+'{«' + str + '»}«';
  };

  blk[':'] = function(str){
    var match, cond;

    if (match = parenthetical(str)){
      cond = match.value;
      str = str.substr(match.pos);
    }
    return '»} else '+(cond ? 'if '+cond : '') + '{«' + str;
  };

  blk['+'] = function(str){
    var match, alias, location, re=/^\s*(\w+)/g;

    if (!(match = re.exec(str))) throw new Error('Import block missing alias');
    alias = match.value;
    str = str.substr(re.lastIndex);
    if (!(match=parenthetical(str))) throw new Error('Import block missing template location');
    location = match.value;
    str = str.substr(match.pos);

    return '»var ' + alias + ' = require' + location + ';';
  };

  blk['>'] = function(str){
    var match, target, args, re=/^\s*(\w+)/g;

    if (!match=re.exec(str)) throw new Error('Invoke block missing template name');
    target = match[1];
    str = str.substr(re.lastIndex);

    if (!match = parenthetical(str)) throw new Error('Invoke block missing ()');
    args = match.value;
    str = str.substr(match.pos);

    return '»(function(){«' + str + '»out+=' + target + args + ';}());«';
  };

  blk['<'] = function(str){
    var match, target, args, re=/^\s*(\w+)/g;

    if (!match=re.exec(str)) throw new Error('Yield block missing template name');
    target = match[1];
    str = str.substr(re.lastIndex);

    if (!match = parenthetical(str)) throw new Error('Yield block missing ()');
    args = match.value;
    str = str.substr(match.pos);

    return '»if (typeof '+target+' ==="function") out+='+target + args + '; else {«' + str +'»}«';
  };

  blk['!'] = function(str){
    return '»' + str + '<<';
  };

  function parenthetical(str){
    var match, re = /^\s*\(/g;
    var pos=0, expr;
    
    if (!(match=re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);
    expr = '(';

    re = /^((?:(?!«|»).)*?)(\(|\))/g;
    while (match = re.exec(str)){
      if (')' === match[2]){
        return {
            pos: pos+re.lastIndex
          , value: expr + match[0]
        };
      }
      else {
        expr += match[1];
        pos += re.lastIndex-1;
        str = str.substr(re.lastIndex-1);
        if (match = parenthetical(str)){
          expr += match.value;
          pos += match.pos;
          str = str.substr(match.pos);
        }
      }
    }
    throw new Error('Parenthetical missing )');
  }

  module.exports = function(str){

    var fn, match, re=/\{\{([%@\?:\+><!]?)((?:(?!\{\{)[\s\S])*?)([%@\?:\+><!]?)\}\}/;

    while (match = re.exec(str)) {
      var sym = match[1] || '=';
      var spos = match.index;
      var epos = spos + match[0].length;

      if (match[3] && (match[3] != sym)){
        console.error(str.substring(spos-5, epos+5));
        throw new Error('{{'+match[1] + ' at ' +(spos+2) + " doesn't match " + match[3] + '}} at ' +(epos-2));
      }

      if (blk.hasOwnProperty(sym)){
        try {
          str = str.substr(0, spos) + blk[sym](match[2]) + str.substr(epos);
        }
        catch (ex){
          throw new Error(ex + ' in ' + sym + 'block between position ' + spos + ' and position ' +epos);
        }
      }
      else {
        str = str.substr(0, spos) + "»" + sym +' ' + match[2] + ' ' + sym + "«" + str.substr(epos);
      }
    }

    fn = /*new Function(*/str.replace(/«([\s\S]*?)»/g, function(m, o){
      return "out += '" + o.replace(/\\'/g, '\\$&').replace(/'/g, '\\$&').replace(/\r|\n/g, '\\n') + "';"
    }).replace(/«|»/g, '');// + ".apply(arguments);");

    return (new Function('return '+fn))();
  }
}());
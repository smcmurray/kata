(function(){
  'use strict';

  var blk = {};

  function genError(msg, pos){
    return new Error(msg +' at position ' + pos);
    return new Error({msg: msg, pos: pos});
  }

  function posErr(err, pos){
    return genError(err, pos);
    return new Error({msg: err.message.msg, pos: pos + err.message.pos});
  }

  function wrap(f, str, pos){
    var match;
    try {
      match = f(str);
    }
    catch(ex){
      throw posErr(ex, pos);
    }
    return match;
  }

  blk['template'] = function (str){
    var match, re = /^\s*\{\{%/g;
    var pos = 0;
    var name, sig, body=[];

    /* Make sure it starts with {{% */
    if (! (match = re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    /* Check for a name */
    re = /^\s*(\w+)/g;
    if (match = re.exec(str)){
      name = match[1];
      pos += re.lastIndex;
      str = str.substr(re.lastIndex);
    }

    /* Make sure it has () with optional arguments */
    re = /^\s*(\((?:\w+(?:\s*,\s*\w+)*)?\))/g
    if (!(match = re.exec(str))) return;
    sig=match[1];
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    /* Look for other blocks inside */
    while (match){
      /* check for end of block */
      if (match = end(str)){
        if (match.value && match.value != '%') throw genError('Template block is missing }}', pos);
        pos += re.lastIndex;
        str = str.substr(re.lastIndex);
        break;
      }
      /* Look for other blocks */
      else if (match = wrap(block, str, pos)){
        body.push(match.value);
        pos += match.pos;
        str = str.substr(match.pos);
      }
    }
    if (! match) throw genError('Template block missing }}', pos);
    match = 'function ' + (name ? name : '') + sig + '{'
          +'  var self = this;\n'
          +'  var out = "";\n'
          +   body.join('\n') + (body.length ? '\n' : '')
          + 'return out;\n}';
    match.kataname = name;

    return {pos: pos , value: match};
  };

  blk['interpolate'] = function (str){
    var match, re=/^\s*\{\{(?![%@\?:><\+!])/g;
    var pos = 0, expr;

    if (!(match=re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    if (match = wrap(other, str, pos)){
      expr = match.value;
      pos += match.pos;
      str = str.substr(match.pos);
    }

    if ((!(match = end(str))) || match.value) throw genError('Interpolate block missing }}', pos);

    return {
        pos: pos + match.pos
      , value: 'out += (' + expr + ").replace(/\"/g, '\\\"');"
    };
  };

  blk['iterate'] = function (str){
    var match, re=/^\s*\{\{@/g;
    var pos = 0, expr, sig, body=[];

    if (!(match = re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    /* check for (expression) */
    if (!(match = wrap(parenthetical, str, pos))) throw genError('Iterate block missing (expression)', pos);
    pos += match.pos;
    str = str.substr(match.pos);
    expr = match.value;

    /* check for (args) */
    re = /^\s*(\(\s*\w+(?:\s*,\s*\w+)*\))/g;
    if (!(match = re.exec(str))) throw genError('Iterate block missing (args)', pos);
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);
    sig = match[1];

    while (match){
      if (match = end(str)){
        if (match.value && match.value != '@') throw genError('Iterate block missing }}', pos);
        pos += match.pos;
        break;
      }
      else if (match = wrap(block, str, pos)){
        pos += match.pos;
        str = str.substr(match.pos);
        body.push(match.value);
      }
    }
    if (! match) throw genError('Iterate block missing }}', pos);
    return {
        pos: pos
      , value: '('+expr+').forEach(function' + sig + '{'
         + (body.length ? '\n' : '')
         + body.join('\n')
         + (body.length ? '\n' : '')
         + '});'
    };
  };

  blk['conditional'] = function (str){
    var match, re=/^\s*\{\{\?/g;
    var pos=0, expr, body=[];

    if (!(match = re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    if (!(match = wrap(parenthetical, str, pos))) throw genError('Conditional block missing (expression)', pos);
    pos += match.pos;
    str = str.substr(match.pos);
    expr = match.value;

    while (match){
      if (match = end(str)){
        if (match.value && match.value != '?') throw genError('Conditional block missing }}', pos);
        pos += match.pos;
        break;
      }
      else if (match = wrap(block, str, pos)){
        pos += match.pos;
        str = str.substr(match.pos);
        body.push(match.value);
      }
    }
    if (! match) { // Haven't hit the end yet
      match = true;
      while (match){
        if (match = end(str)){
          if (match.value && match.value != '@') throw genError('Conditional block missing }}', pos);
          pos += match.pos;
          break;
        }
        else if (match = wrap(blk['else'], str, pos)){
          pos += match.pos;
          str = str.substr(match.pos);
          body.push(match.value);
        }
      }
      if (! match) throw genError('Conditional block is missing }}', pos);
    }
    return {
        pos: pos
      , value: 'if ' +expr+'{'
         + (body.length ? '\n' : '')
         + body.join('\n')
         + (body.length ? '\n' : '')
         + '}'
    };
  };

  blk['else'] = function (str){
    var match, re=/^\s*\{\{:/g;
    var pos=0, expr, body=[];

    if (!(match = re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    if (match = wrap(parenthetical, str, pos)){
      pos += match.pos;
      str = str.substr(match.pos);
      expr = match.value;
    }

    while (match){
      if (match = end(str)){
        if (match.value && match.value != ':') throw genError('Elseif block missing }}', pos);
        pos = match.pos;
        break;
      }
      else if (match = wrap(block, str, pos)){
        pos += match.pos;
        str = str.substr(match.pos);
        body.push(match.value);
      }
    }
    if (! match) { // Haven't hit the end yet
      match = true;
      while (match){
        if (match = end(str)){
          if (match.value && match.value != ':') throw genError('Elseif block missing }}', pos);
          pos += match.pos;
          break;
        }
        else if (match = wrap(blk['else'], str, pos)){
          pos += match.pos;
          str = str.substr(match.pos);
          body.push(match.value);
        }
      }
      if (! match) throw genError('Elseif block is missing }}', pos);
    }
    return {
        pos: pos
      , value: '} else ' +(expr ? 'if '+expr : '')+'{'
         + (body.length ? '\n' : '')
         + body.join('\n')
    };

  };

  blk['invoke'] = function (str){
    var match, re=/^\s*\{\{>/g;
    var pos = 0, target, sig, body=[];

    if (!(match = re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    re = /^\s*(\w+)/g;
    if (!(match = re.exec(str))) throw genError('Invoke block missing template name', pos);
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);
    target = match[0];

    if (!(match = wrap(parenthetical, str, pos))) throw genError('Invoke block missing template arguments', pos);
    pos += match.pos;
    str = str.substr(match.pos);
    sig = match.value;

    while (match){
      if (match = end(str)){
        if (match.value && match.value != '<') throw genError('Invoke block missing }}', pos);
        pos += match.pos;
        break;
      }
      else if (match = wrap(blk['template'], str, pos)){
        pos += match.pos;
        str = str.substr(match.pos);
        body.push(match.value);
      }
    }
    if (! match) throw genError('Invoke block missing }}', pos);
    return {
        pos: pos
      , value: 'out += ' + target
              + (body.length ? '.bind({' + body.reduce(function(o, f){
                  if (f.kataname) o.push(f.kataname + ':' + f);
                  return o;
                }, []).join(',') + '})' : '')
              + sig + ';'
    };
  };

  blk['yield'] = function(str){
    var match, re=/^\s*\{\{</g;
    var pos=0, target, sig, body=[];

    if (!(match = re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    re = /^\s*(\w+)/g;
    if (!(match = re.exec(str))) throw genError('Yield block missing template name', pos);
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);
    target = match.value;

    if (!(match = wrap(parenthetical, str, pos))) throw genError('Yield block missing template arguments', pos);
    pos += match.pos;
    str = str.substr(match.pos);
    sig = match.value;

    while (match){
      if (match = end(str)){
        if (match.value && match.value != '>') throw genError('Yield block missing }}', pos);
        pos += match.pos;
        break;
      }
      else if (match = wrap(block, str, pos)){
        pos += match.pos;
        str = str.substr(match.pos);
        body.push(match.value);
      }
    }
    if (! match) throw genError('Yield block missing }}', pos);
    return {
      pos: pos
      , value: 'if (self.'+target+') out += self.' + target + sig + ';'
              +' else {'
              +   body.join('')
              + '}'
    };
  };

  blk['import'] = function(str){
    var match, re=/^\s*\{\{\+/g;
    var pos=0, alias, location;

    if (!(match = re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    re = /^\s*(\w+)/g;
    if (!(match = re.exec(str))) throw genError('Import block missing template alias', pos);
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);
    alias = match[1];

    if (!(match = wrap(parenthetical, str, pos))) throw genError('Import block missing template location', pos);
    pos += match.pos;
    str = str.substr(match.pos);
    location = match.value;

    if ((!(match = end(str)))|| (match.value && match.value != '+')) throw genError('Import block missing }}', pos);
    return {
      pos: pos + match.pos
      , value: 'var '+alias+'=require'+location+';'
    };
  };

  blk['evaluate'] = function(str){
    var match, re=/^\s*\{\{!/g;
    var pos=0, expr;

    if (!(match = re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);

    if (match = other(str)){
      pos += match.pos;
      str = str.substr(match.pos);
      expr = match.value;
    }

    if ((!(match = end(str)))|| (match.value && match.value != '!')) throw genError('Evaluate block missing }}', pos);
    return {
      pos: pos + match.pos
      , value: expr ? expr : ''
    };
  };

  function parenthetical(str){
    var match, re = /^\s*\(/g;
    var pos=0, expr;
    
    if (!(match=re.exec(str))) return;
    pos += re.lastIndex;
    str = str.substr(re.lastIndex);
    expr = '(';

    re = /^((?:(?!{{|}}).)*?)(\(|\))/g;
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
        if (match = wrap(parenthetical, str. pos)){
          expr += match.value;
          pos += match.pos;
          str = str.substr(match.pos);
        }
      }
    }
    throw genError('Parenthetical missing )', pos);
  }

  function other(str){
    var match, re = /\{\{|[%@\?><\+!]?\}\}/g;
    var pos = 0;

    if (!(match = re.exec(str))) throw genError('Block missing }}', pos);
    if (! match.index) return;
    pos += match.index;
    return {
        pos: pos
      , value: str.substr(0, pos)
    };
  }

  function output(str){
    var match = other(str);
    if (match && /\S/.test(match.value)){
      return {
        pos: match.pos
        , value: 'out += "'
                + match.value.replace(/\r|\n/g, '\\n').replace(/"/g, '\\"')
                + '";'
      }
    }
    else return;
  }

  function block(str){
    return blk['template'](str)
        || blk['interpolate'](str)
        || blk['iterate'](str)
        || blk['conditional'](str)
        || blk['invoke'](str)
        || blk['yield'](str)
        || blk['import'](str)
        || blk['evaluate'](str)
        || output(str);
  }

  function end(str){
    var match, re=/^\s*([%@\?:><\+!]?)\}\}/g
    if (match = re.exec(str)) return {pos: re.lastIndex, value: match[1]};
    else return;
  }

  module.exports = function(str){
    var fn;
    if (fn = blk['template'](str)) {
      return fn.value;
    }
    else throw genError('Hmmm', 0);
  };
}());

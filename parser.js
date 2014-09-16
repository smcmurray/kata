(function(name, definition){
  if (typeof module != 'undefined') {
    module.exports = definition();
  }
  else if (typeof define == 'function' && typeof define.amd == 'object') {
    define(definition());
  }
  else this[name] = definition();
}('kata', function(){
  var blk = {}, Block;
  var options = {
    src: false
    , plugins: {}
  };

  Block = Object.create(Object.prototype, {
    parse: {
      value: function(str){
        if (this.parsed) throw new Error('Attempting to reparse ' + this.symbol + ' block');
        if (str && /\S/.test(str))
          this.addChild('c').parse(str).render();
        this.parsed = true;
      }
    }
    , end: {value: null, writable: true}
    , addChild: {
      value: function(symbol, start){
        var match, re, proto;
        if (!(proto = blk[symbol||'='])){
          re = /^#(\w+)/;
          if (!((match=re.exec(symbol)) && (proto = options.plugins[match[1]()]))){
            throw new Error('Unknown block type: '+symbol);
          }
        }
        if (! this.children) this.children = [];
        var n = this.children.push(Object.create(proto, {
          start: {value: start || 0}
        }));
        return this.children[n-1];
      }
    }
    , render: {
      value: function(){
        if (this.children) {
          return this.children.reduce(function(o,b){
            return o+b.rendered;
          }, '');
        }
      }
    }
  });

  blk['root'] = Object.create(Block, {
    parsed: { value: true }
    , addChild: {
      value: function(sym, start){
        if (this.children) throw new Error('Unexpected content after template definition');
        if ('%' != sym) throw new Error('Expected Template block. Templates must begin with {{% ( not '+sym+')');
        return Block.addChild.call(this, sym, start);
      }
    }
    , render: {
      value: function(){
        if (! this.children) throw new Error('No template defined');
        return this.children[0].rendered;
      }
    }
  });

  blk['%'] = Object.create(Block, {
    symbol: {value: '%'}
    , name: {value: null, writable: true}
    , args: {value: null, writable: true}
    , parse: {
      value: function(str){
        var match, re=/^\s*(\w+)/g;
        if (match=re.exec(str)){
          this.name = match[1];
          this.end += re.lastIndex;
          str = str.substr(re.lastIndex);
        }

        if (!(match = parenthetical(str))) throw new Error('Template block missing arguments at position ' + this.end);
        this.args = match.value;
        this.end += match.pos;

        Block.parse.call(this, str.substr(match.pos));
        return this;
      }
    }
    , render: {
      value: function(){
        if (! this.rendered){
          this.rendered = 'function ' + (this.name ? this.name : '') + this.args + "{"
            + "var out='';"
            + Block.render.call(this)
            + "}";
        }
        return this.rendered;
      }
    }
    , addChild: {
      value: function(symbol, start){
        if (symbol === ':') throw new Error('Template blocks cannot contain Elseif blocks directly');
        return Block.addChild.call(this, symbol, start);
      }
    }
  });

  blk['='] = Object.create(Block, {
    symbol: {value: '='}
    , parse: {
      value: function(str){
        this.expr = str.replace(/"/g, '\\"').replace(/\r|\n/g, '\\n');
        Block.parse.call(this);
        return this;
      }
    }
    , render: {
      value: function(){
        if (! this.rendered){
          this.rendered = 'out += ' + this.expr + ';';
        }
        return this.rendered;
      }
    }
    , addChild: {
      value: function(){
        throw new Error('Interpolate blocks cannot contain other blocks');
      }
    }
  });

  blk['@'] = Object.create(Block, {
    symbol: {value: '@'}
    , parse: {
      value: function(str){
        var match;
        if (!(match = parenthetical(str))) throw new Error('Iterate block missing iterable');
        this.iter = match.value;
        str = str.substr(match.pos);
        if (!(match = parenthetical(str))) throw new Error('Iterate block missing arguments');
        this.args = match.value;
        Block.parse.call(this, str.substr(match.pos));
        return this;
      }
    }
    , render: {
      value: function(){
        if (! this.rendered){
          this.rendered = this.iter+'.forEach(function'+this.args+'{'
            + Block.render.call(this)
            + '});';
        }
        return this.rendered;
      }
    }
    , addChild: {
      value: function(sym, start){
        if (sym === ':') throw new Error('Iterate blocks cannot contain Elseif blocks directly');
        return Block.addChild.call(this, sym, start);
      }
    }
  });

  blk['?'] = Object.create(Block, {
    symbol: {value: '?'}
    , parse: {
      value: function(str){
        var match;
        if (!(match = parenthetical(str))) throw new Error('Condition block missing condition');
        this.cond = match.value;
        Block.parse.call(this, str.substr(match.pos));
        return this;
      }
    }
    , render: {
      value: function(){
        if (! this.rendered){
          this.rendered = 'if '+this.cond+'{'
            + Block.render.call(this)
            + '}';
        }
        return this.rendered;
      }
    }
  });

  blk[':'] = Object.create(Block, {
    symbol: {value: ':'}
    , parse: {
      value: function(str){
        var match;
        if (match = parenthetical(str)){
          this.cond = match.value;
          str = str.substr(match.pos);
        }
        Block.parse.call(this, str);
        return this;
      }
    }
    , render: {
      value: function(){
        if (!this.rendered){
          this.rendered = '} else '+(this.cond ? 'if '+this.cond : '') + '{'
          + Block.render.call(this)
        }
        return this.rendered;
      }
    }
  });

  blk['+'] = Object.create(Block, {
    symbol: {value: '+'}
    , parse: {
      value: function(str){
        var match, re=/^\s*(\w+)/g;
        if (!(match = re.exec(str))) throw new Error('Import block missing alias');
        this.alias = match[1];
        str = str.substr(re.lastIndex);
        if (!(match=parenthetical(str))) throw new Error('Import block missing template location');
        this.location = match.value;
        str = str.substr(match.pos);
        Block.parse.call(this, str);

        return this;
      }
    }
    , render: {
      value: function(){
        if (!this.rendered){
          this.rendered = 'var ' + this.alias + ' = require' + this.location + ';';
        }
        return this.rendered;
      }
    }
    , addChild: {
      value: function(){ throw new Error('Import blocks cannot contain other blocks.')}
    }
  });

  blk['>'] = Object.create(Block, {
    symbol: {value: '<'}
    , parse: {
      value: function(str){
        var match, re=/^\s*(\w+)/g;
        if (!(match=re.exec(str))) throw new Error('Invoke block missing template name');
        this.signature = match[1];
        this.end += re.lastIndex;
        str = str.substr(re.lastIndex);

        if (!(match = parenthetical(str))) throw new Error('Invoke block missing ()');
        this.signature += match.value;
        this.end += match.pos;
        Block.parse.call(this, str.substr(match.pos));

        return this;
      }
    }
    , render: {
      value: function(){
        if (!this.rendered){
          this.rendered = 'out+=(function(){'
            + Block.render.call(this)
            + this.signature + ';}());';
        }
        return this.rendered;
      }
    }
    , addChild: {
      value: function(sym, start){
        if ('%' != sym) throw new Error('Invoke blocks can only contain Template blocks,');
        return Block.addChild.call(this, sym, start);
      }
    }
  });

  blk['<'] = Object.create(Block, {
    symbol: {value: '>'}
    , parse: {
      value: function(str){
        var match, re=/^\s*(\w+)/g;
        if (!(match=re.exec(str))) throw new Error('Yield block missing template name');
        this.target = match[1];
        str = str.substr(re.lastIndex);

        if (!(match = parenthetical(str))) throw new Error('Yield block missing ()');
        this.args = match.value;
        str = str.substr(match.pos);
        Block.parse.call(this, str);
        return this;
      }
    }
    , render: {
      value: function(){
        if (! this.rendered){
          this.rendered = 'if (typeof '+target+' ==="function") out+='+this.target + this.args + '; else {'
          + Block.render.call(this)
          + '}';
        }
        return this.rendered;
      }
    }
  });

  blk['!'] = Object.create(Block, {
    symbol: {value: '!'}
    , parse: {
      value: function(str){
        this.expr = str;
        Block.parse.call(this);
        return this;
      }
    }
    , render: {
      value: function(){
        if (! this.rendered){
          this.rendered = this.expr;
        }
        return this.rendered;
      }
    }
    , addChild: {
      value: function(){
        throw new Error('Evaluate blocks cannot contain other blocks');
      }
    }
  });

  blk['c'] = Object.create(Block, {
    symbol: {value: 'c'}
    , parse: {
      value: function(str){
        this.expr = str.replace(/"/g, '\\"').replace(/\r|\n/g, '\\n');
        Block.parse.call(this);
        this.end = this.start + str.length;
        return this;
      }
    }
    , render: {
      value: function(){
        if (! this.rendered){
          this.rendered = 'out+="' + this.expr + '";';
        }
        return this.rendered;
      }
    }
  });

  function parenthetical(str){
    var match, re = /^\s*\(/g;
    var expr='', count=0;
    
    if (! /^\s*\(/.test(str)) return;

    re = /\s*((?:(?!\{\{|\(|\)|\}\})[\s\S])*?)(\(|\))/g;
    while (match = re.exec(str)){
      if ('(' === match[2]) count += 1;
      else count -=1;
      expr += (match[1] ? match[1]: '') + match[2];
      if (! count) {
        return {pos: re.lastIndex
          , value: expr
        };
      }
    }
    throw new Error('Parenthetical missing )');
  }

  return function(str, opts){
    var root = Object.create(blk['root'], {start: {value: 0}}), cur=root;
    var q = [root], tmp;
    var match, re=/((?:(?!\{\{(?:[%@\?:\+><!]|#\w+)?|[%@\?:\+><!#]?\}\})[\s\S])*)(\{\{(?:[%@\?:\+><!]|#\w+)?|[%@\?:\+><!#]?\}\})/g;
    if (opts){
      Object.keys(options).forEach(function(k){
        if (opts.hasOwnProperty(k)){
          options[k] = opts[k];  
        }
      });
    }

    while(q.length && (match = re.exec(str))){
      //Everything between the last match and now is content
      //Or could be block signature + content
      if (match[1] && match[1].length){
        if (cur.parsed){ // This block has already been parsed. So match[1] must be content.
          cur.addChild('c', match.index).parse(match[1]).render();
        }
        else {
          cur.parse(match[1]);
        }
      }
      if ('{{' === match[2].substr(0,2)){
        q.push(cur.addChild(match[2].substr(2), re.lastIndex-match[2].length));
      }
      else if (cur.symbol === 'root') {
        throw new Error('Expecting {{% but found ' + match[2] + ' at position ' + (re.lastIndex-match[2].length));
      }
      else {
        /* This must be a }}
        /* Make sure start and end symbols match */
        sym = (3 === match[2].length ? match[2].substr(0,1) : this.symbol);
        if (sym && sym != cur.symbol) throw new Error('{{'+cur.symbol+' at position ' + cur.start + ' does not match ' + sym +'}} at position '+(re.lastIndex-3));
        cur.e = re.lastIndex;
        cur.render();
        q.pop();
      }
      cur = q[q.length-1];
    }
    if (cur !== root){
      throw new Error('Failed to find end of {{' + cur.sym + ' block begun at position ' + cur.s
      + '\nq has '+q.length + ' items');
    }

    if (options.src) {
      return "(function(name, definition){"
      +"  'use strict';"

      +"  if (typeof module != 'undefined') {"
      +"    module.exports = definition(require);"
      +"  }"
      +"  else if (typeof define == 'function' && typeof define.amd == 'object') {"
      +"    define(definition);"
      +"  }"
      +"  else this[name] = definition();"
      +"}('template', function(require){ return " + root.render() + "}))";
    }
    else return (new Function('return '+root.render()))();
  }
}));
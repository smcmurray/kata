(function(name, definition){
  if (typeof module != 'undefined') {
    module.exports = definition();
  }
  else if (typeof define == 'function' && typeof define.amd == 'object') {
    define(definition());
  }
  else this[name] = definition();
}('kata', function(){
  var blk = {};

  var Block = Object.create(Object.prototype, {
    parse: {
      value: function(str){
        if (str && /\S/.test(str))
          this.addChild('c').parse(str);
        this.parsed = true;
      }
    }
    , end: {value: null, writable: true}
    , children: {value: [], writable: true}
    , addChild: {
      value: function(symbol, start){
        var n = this.children.push(Object.create(blk[symbol||'='], {
          start: {value: start}
        }));
        console.log('Added child ', symbol);
        return this.children[n-1];
      }
    }
  });

  blk['root'] = Object.create(Block, {
    parsed: { value: true }
    , addChild: {
      value: function(sym, start){
        if ('%' != sym) throw new Error('Expected Template block. Templates must begin with {{%');
        Block.addChild.call(this, sym, start);
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
        return 'function ' + (this.name ? this.name : '') + this.args + "{"
          + "var out='';"
          + this.children.reduce(function(o,b){
            return o+b.render();
          }, '')
          + "}";
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
    parse: {
      value: function(str){
        this.expr = str.replace(/"/g, '\\"').replace(/\r|\n/g, '\\n');
        Block.parse.call(this);
        return this;
      }
    }
    , render: {
      value: function(){
        return 'out += ' + this.expr + ';';
      }
    }
    , addChild: {
      value: function(){
        throw new Error('Interpolate blocks cannot contain other blocks');
      }
    }
  });

  blk['@'] = Object.create(Block, {
    parse: {
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
    , render: function(){
      return this.iter+'.forEach(function'+this.args+'{'
        + this.children.reduce(function(o,b){
          return o+b.render();
        }, '')
        + '});';
    }
    , addChild: {
      value: function(sym, start){
        if (sym === ':') throw new Error('Iterate blocks cannot contain Elseif blocks directly');
        return Block.addChild.call(this, sym, start);
      }
    }
  });

  blk['?'] = Object.create(Block, {
    parse: {
      value: function(str){
        var match;
        if (!(match = parenthetical(str))) throw new Error('Condition block missing condition');
        this.cond = match.value;
        Block.parse.call(this, str.substr(match.pos));
        return this;
      }
    }
    , render: function(){
      return 'if '+this.cond+'{'
        + this.children.reduce(function(o,b){
          return o+b.render();
        }, '')
        + '}';
    }
  });

  blk[':'] = Object.create(Block, {
    parse: {
      value: function(str){
        var match;
        if (match = parenthetical(str)){
          this.cond = match.value;
          str = str.substr(match.pos);
        }
        Block.parse.call(this, str.substr(match.pos))
        return this;
      }
    }
    , render: {
      value: function(){
        return '} else '+(this.cond ? 'if '+this.cond : '') + '{'
        + this.children.reduce(function(o,b){
          return o+b.render();
        }, '');
      }
    }
  });

  blk['+'] = Object.create(Block, {
    parse: {
      value: function(str){
        var match, re=/^\s*(\w+)/g;
        if (!(match = re.exec(str))) throw new Error('Import block missing alias');
        this.alias = match.value;
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
        return 'var ' + this.alias + ' = require' + this.location + ';';
      }
    }
    , addChild: {
      value: function(){ throw new Error('Import blocks cannot contain other blocks.')}
    }
  });

  blk['>'] = Object.create(Block, {
    parse: {
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
        return 'out+=(function(){'
          + this.children.reduce(function(o,b){
              return o+b.render();
            }, '')
          + this.signature + ';}());';
      }
    }
    , addChild: {
      value: function(sym, start){
        if ('%' != sym) throw new Error('Invoke blocks can only contain Template blocks,');
        Block.addChild.call(this, sym, start);
      }
    }
  });

  blk['<'] = Object.create(Block, {
    parse: {
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
        return 'if (typeof '+target+' ==="function") out+='+this.target + this.args + '; else {'
        + this.childdren.reduce(function(o,b){
            return o+b.render();
          }, '')
        + '}';
      }
    }
  });

  blk['!'] = Object.create(Block, {
    parse: {
      value: function(str){
        this.expr = str;
        Block.parse.call(this);
        return this;
      }
    }
    , render: {
      value: function(){
        return this.expr;
      }
    }
    , addChild: {
      value: function(){
        throw new Error('Evaluate blocks cannot contain other blocks');
      }
    }
  });

  blk['c'] = Object.create(Block, {
    parse: {
      value: function(str){
        this.expr = str.replace(/"/g, '\\"').replace(/\r|\n/g, '\\n');
        Block.parse.call(this);
        return this;
      }
    }
    , render: {
      value: function(){
        return 'out+="' + this.expr + '";';
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

  return function(str, options){
    var root = Object.create(blk['root'], {start: {value: 0}}), cur=root;
    var q = [root], tmp;
    var match, re=/((?:(?!\{\{[%@\?:\+><!]?|[%@\?:\+><!]?\}\})[\s\S])*)(\{\{[%@\?:\+><!]?|[%@\?:\+><!]?\}\})/g;

    while(q.length && (match = re.exec(str))){
      //Everything between the last match and now is content
      //Or could be block signature + content
      if (match[1] && match[1].length){
        console.error('Cur: ', cur);
        if (cur.parsed){ // This block has already been parsed. So match[1] must be content.
          cur.addChild('c', match.index).parse(match[1]);
        }
        else {
          cur.parse(match[1]);
        }
      }
      if ('{{' === match[2].substr(0,2)){
        q.push(cur.addChild(match[2].substr(2) || '=', re.lastIndex-match[2].length));
      }
      else if (cur.symbol === 'root') {
        throw new Error('Expecting {{% but found ' + match[2] + ' at position ' + (re.lastIndex-match[2].length));
      }
      else {
        /* This must be a }}
        /* Make sure start and end symbols match */
        sym = (3 === match[2].length ? match[2].substr(0,1) : this.symbol);
        if (sym && sym != cur.symbol) throw new Error('{{'+cur.symbol+' at position ' + cur.s + ' does not match ' + sym +'}} at position '+re.lastIndex-3);
        cur.e = re.lastIndex;
        q.pop();
      }
      cur = q[q.length-1];
    }
    if (cur !== root){
      console.log('Root: ', root);
      throw new Error('Failed to find end of {{' + cur.sym + ' block begun at position ' + cur.s
      + '\nq has '+q.length + ' items');
    }
    root.e = root.blocks[root.blocks.length-1].e
    tmp = str.substr(root.e);
    if (tmp && /\S/.test(tmp)) throw new Error('Unexpected content after template at position ' + root.e);

    return root.blocks.reduce(function(o,b){return o+b.value}, '');
  }
}));
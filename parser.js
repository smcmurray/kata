(function(name, definition){
  if (typeof module != 'undefined') {
    module.exports = definition();
  }
  else if (typeof define == 'function' && typeof define.amd == 'object') {
    define(definition());
  }
  else this[name] = definition();
}('kata', function(str, options){
  var blk = {};

  var Block = Object.create(Object.prototype, {
    parse: {
      value: function(str){
        this.addChild('c').parse(str);
      }
    }
    , end: {value: null, writable: true}
    , children: {value: [], writable: true}
    , addChild: {
      value: function(symbol, start){
        var n = this.children.push(Object.create(blk[symbol||'='], {
          start: {value: start}
        }));
        return this.children[n-1];
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

        if (match.pos < str.length)
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
          }, '');
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
        this.expr = str;
        return this;
      }
    }
    , render: {
      value: function(){
      return 'out += ' + this.expr.replace(/"/g, '\\"').replace(/\r|\n/g, '\\n') + ';';
    }
    , addChild: {
      value: function(){
        throw new Error('Interpolate blocks cannot contain other blocks');
      }
    }
  };

  blk['@'] = Object.create(Block, {
    parse: {sig: function(str){
      var match, pos;
      if (!(match = parenthetical(str))) throw new Error('Iterate block missing iterable');
      this.iter = match.value;
      str = str.substr(match.pos);
      if (!(match = parenthetical(str))) throw new Error('Iterate block missing arguments');
      this.args = match.value;
      if (match.pos < str.length)
        Block.parse.call(this, str.substr(match.pos));
      return this;
    },
    render: function(){
      return this.iter+'.forEach(function'+this.args+'{'
        + this.children.reduce(function(o,b){
          return o+b.render();
        }, '');
        + '});';
    }
    , addChild: {
      value: function(sym, start){
        if (sym === ':') throw new Error('Iterate blocks cannot contain Elseif blocks directly');
        return Block.addChild.call(this, sym, start);
      }
    }
  };

  blk['?'] = Object.create(Block, {
    parse: {
      value: function(str){
      var match;
      if (!(match = parenthetical(str))) throw new Error('Condition block missing condition');
      this.cond = match.value;
      if (match.pos < str.length){
        Block.parse.call(this, str.substr(match.pos));
      }
      return this;
    }
    , render: function(){
      return 'if '+this.cond+'{'
        + this.children.reduce(function(o,b){
          return o+b.render();
        }, '')
        + '}';
    }
  };

  blk[':'] = Object.create(Block, {
    parse: {
      value: function(str){
        var match;
        if (match = parenthetical(str)){
          this.cond = match.value;
          str = str.substr(match.pos);
        }
        if (match.pos < str.length){
          Block.parse.call(this, str.substr(match.pos))
        }
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
  };

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
      if (match.pos <str.length){
        Block.parse.call(this, str);
      }

      return this;
    }
    , render: {
        value: function(){
        return 'var ' + this.alias + ' = require' + this.location + ';';
    }
    , addChild: {
      value: function(){ return throw new Error('Import blocks cannot contain other blocks.')}
    }
  };

  blk['>'] = {sig: function(str){
      var match, re=/^\s*(\w+)/g;
      var sig = {target: null
        , args: null
        , pos: 0
      };
      if (!(match=re.exec(str))) throw new Error('Invoke block missing template name');
      sig.target = match[1];
      sig.pos += re.lastIndex;
      str = str.substr(re.lastIndex);

      if (!(match = parenthetical(str))) throw new Error('Invoke block missing ()');
      sig.args = match.value;
      sig.pos += match.pos;
      return sig;
    }
    , render: function(sig, blocks){
      return 'out+=(function(){'
        + blocks.reduce(function(o,b){
            if ('%' !== b.sym) throw new Error('Invoke blocks can only contain Template blocks,');
            return o+b.value;
          }, '')
        + sig.target + sig.args + ';}());';
    }
  };

  blk['<'] = {sig: function(str){
      var match, target, args, re=/^\s*(\w+)/g;
      if (!(match=re.exec(str))) throw new Error('Yield block missing template name');
      target = match[1];
      str = str.substr(re.lastIndex);

      if (!(match = parenthetical(str))) throw new Error('Yield block missing ()');
      args = match.value;
      str = str.substr(match.pos);
    }
    , render: function(sig, blocks){
      return 'if (typeof '+target+' ==="function") out+='+sig.target + sig.args + '; else {'
      + blocks.reduce(function(o,b){
          return o+b.value;
        }, '')
      + '}';
    }
  };

  blk['!'] = {sig: function(str){
      return { expr: str , pos: str.length };
    }
    , render: function(sig, blocks){
      if (blocks.length) throw new Error('Evaluate blocks cannot contain other blocks');
      return sig.expr;
    }
  };

  blk['c'] = {sig: function(str){
      return {content: str};
    }
    , render: function(sig, blocks){
      return 'out+="' + sig.content.replace(/"/g, '\\"').replace(/\r|\n/g, '\\n') + '";';
    }
  };

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

  return function(str){
    var root = {sym: 'root', s: 0, blocks: []}, cur=root;
    var q = [root], tmp;
    var match, re=/((?:(?!\{\{[%@\?:\+><!]?|[%@\?:\+><!]?\}\})[\s\S])*)(\{\{[%@\?:\+><!]?|[%@\?:\+><!]?\}\})/g;

    while(q.length && (match = re.exec(str))){
      //Everything between the last match and now is content
      //Or could be block signature + content
      if (match[1] && match[1].length){
        if (cur.sig){ // This block already has a sig. So match[1] must be content.
          cur.blocks.push({sym: 'c'
            , s: match.index
            , e: re.lastIndex-match[2].length
            , sig: blk['c'].sig(match[1])
            , blocks:[]
          });
        }
        else {
          try {
            cur.sig = blk[cur.sym].sig(match[1]);
          }
          catch(ex){
            throw new Error(ex + ': block starting at position ' + cur.s);
          }
          if (cur.sig.pos < match[1].length){ // There is content after the sig.
            cur.blocks.push({sym: 'c'
              , s: cur.sig.pos
              , e: re.lastIndex-match[2].length
              , sig: blk['c'].sig(match[1].substr(cur.sig.pos))
              , blocks:[]
            });
          }
        }
      }
      if ('{{' === match[2].substr(0,2)){
        sym = match[2].substr(2) || '=';

        tmp = cur.blocks.push({sym: sym, s: re.lastIndex-match[2].length, blocks: []});
        q.push(cur.blocks[tmp-1]);
      }
      else if (cur.sym === 'root') {
        throw new Error('Expecting {{% but found ' + match[2] + ' at position ' + (re.lastIndex-match[2].length));
      }
      else {
        /* This must be a }}
        If so, all the child blocks have been rendered.
        We are now ready to render this block.*/

        /* First make sure start and end symbols match */
        sym = (3 === match[2].length ? match[2].substr(0,1) : cur.sym);
        if (sym && sym != cur.sym) throw new Error('{{'+cur.sym+' at position ' + cur.s + ' does not match ' + sym +'}} at position '+re.lastIndex-3);
        cur.e = re.lastIndex;
        try {
          cur = {sym: cur.sym, value: blk[sym].render(cur.sig, cur.blocks)};
          console.log('*** ' + cur.value + ' ***');
        }
        catch(ex){
          throw new Error(ex + ' in block from position ' + cur.s + ' to position ' + cur.e);
        }
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
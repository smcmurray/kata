var blocks = {
  'interpolate': /(?!\\)\{\{\s*([\s\S]+?)(?!\\)\}\}/g, /* {{expr}}*/
     'evaluate': /(?!\\)\{\{\!\s*([\s\S]+?)\!?(?!\\)\}\}/g, /* {{! expr !}}*/
       'import': /(?!\\)\{\{\+\s*(\w+)\s*\(([\s\S]*?)\)\s*\+?(?!\\)\}\}/g,
     'template': /(?!\\)\{\{%\s*(\w+\s*\([\s\S]*?\))([\s\S]*?)%?\}\}/g,
       'invoke': /(?!\\)\{\{>\s*(\w+)\s*\(([\s\S]*?)\)<?\}\}/g,
      'iterate': /(?!\\)\{\{@\s*\((.+?)\)\((.*?)\)\s*@?\}\}/g,
  'conditional': /(?!\\)\{\{\?\s*\((.+?)([\s\S]+?)\??\}\}/g,
         'else': /(?!\\)\{\{:\s*\(([\s\S])*?)\)([\s\S]+?:?\}\}/g,
        'yield': /(?!\\)\{\{<\s*(\w+)\s*\(([\s\S]*?)\)>?\}\}/g
};


var fn = ("var out = '" +
  /* Interpolation */
  src.replace(blocks.interpolate, function(m, expr){
    return "'+(" + expr + ") + '";
  })
  /* Evaluation */
  .replace(blocks.evaluate, function(m, expr){
    return "'; ("+expr+"); out += '";
  })
  /* Import */
  .replace(blocks.import, function(m, alias, expr){
    return "'; var " + alias + "=require("+expr+"); out += '";
  })
  .replace(blocks.template, function(m, sig, body){
    return "'; function " + name + 
  });
);
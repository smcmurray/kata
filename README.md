Kata
====

Javascript JSON templating engine

## Install

````
$ npm install kata
````

## API

````js
var kata = require('kata');
var fs = require('fs');

fs.readFile('template.kata', {encoding: 'utf8'}, function(err, src){
  var template;
  if (err) return;

  template = kata(src);
  console.log(template({greeting: 'Hello', name: 'World'}));
});
````

## Template Syntax

Kata templates employ ten different types of blocks.

* {{% [Template block](#Template) %}}
* {{ [Interpolate block](#Interpolate) }}
* {{@ [Iterate block](#Iterate) @}}
* {{? [Conditional block](#Conditional) ?}}
* {{: [Else block](#Else) :}}
* {{> [Invoke block](#Invoke) <}}
* {{< [Yield block](#Yield) >}}
* {{+ [Include block](#Include) +}}
* {{! [Evaluate block](#Evaluate) !}}
* {{# [Plugin block](#Plugin) #}}

### <a name="Template"></a> Template block {{%[name\]([argument [, argument...]]) body [%]}}

All templates must be contained within a template block. Template blocks are converted to javascript functions. A template block has the following elements:

* `name` - (optional) The name of the template. Root templates can be invoked anonymously and don't need names. But subtemplates need a name to be the target of an Invoke block. (See Invoke block below.)
* `arguments` - (optional) Arguments are part of the function signature. Values passed to the template will be assigned to variables of these names within the template.
* `body` - The body of the block contains the content you wish to render. It can contain all the blocks types except Else blocks (which can only be included in conditional blocks). It can also contain any non-block content you wish to render.

### <a name="Interpolate"></a> Interpolate block {{ body }}

Contents of Interpolate blocks are interpolated as a javascript expression and rendered directly.

* `body` - A javascript expression. Interpolate blocks cannot contain any block types.

### <a name="Iterate"></a> Iterate block {{@(expression)(value [, index [, array]]) body [@]}}

Iterate blocks perform a Javascript forEach iteration over the results of the provided expression.

* `expression` - a Javascript expression that resolves to an Array
* `value` - the name of the variable to be assigned the value of each element in the array during the iteration
* `index` - (optional) the name of the variable to be assigned the value of each element's index in the array during the iteration
* `array` - (optional) the name of the variable to be assigned the value of the array over which the template iterates
* `body` The body of the block contains the content you wish to render. It can contain all the blocks types except Else blocks (which can only be included in conditional blocks). It can also contain any non-block content you wish to render for each iteration.

### <a name="Conditional"></a> Conditional block {{?(expression) body [?]}}

Conditional block provide an if/else ability

* `expression` - A Javascript expression. The contents of the block are rendered if the expression is truthy.
* `body` - The body of the block contains the content you wish to render. It can contain all the blocks types. It can also contain any non-block content you wish to render.

### <a name="Else"></a> Else block {{|(expression) body [|]}}

Else blocks provide the 'else' ability of a Conditional block. They can take an optional expression to take on an 'else if ' nature.

* `expression` - (optional) A Javascript expression. The contents of the block are rendered if the expression is truthy. If omitted, the contents of the block are rendered if the expression of the parent Conditional block is falsy.
*`body` - The body of the block contains the content you wish to render. It can contain all the blocks types except Else blocks (which can only be included in conditional blocks). It can also contain any non-block content you wish to render.

### <a name="Invoke"></a> Invoke block {{>name(argument [, argument...]) body [<]}}

Invoke blocks will invoke named templates and pass them the arguments specified. Invoke blocks can extend the invoked block by defining child templates.

* `name` - The name of the template to invoke.
* `arguments` - Values to pass to the invoked template
* `body` - The body of an Invoke block can only contain Template blocks

### <a name="Yield"></a> Yield block {{<(expression) body [>]}}

Yield block allow Template blocks to be extended by yielding to the template that invoked them.

* `expression` - A Javascript expression that will evaluate to the name of a child template within the Invoke block that invoked this template.
* `body` - The body of the block contains the fallback content you wish to render. The contents of a yield block are only rendered if a matching extension template was not found in the Invoke block that invoked the parent Template block. A Yield block can contain all the block types except Else blocks (which can only be included in conditional blocks). It can also contain any non-block content you wish to render.

### <a name="Include"></a> Include block {{+alias(expression)[+]}}

An Include block can import an external template.

* `alias` - The name assigned to the imported template.
* `expression` - A javascript expression that will be evaluated and used as the path from which to import the template.

### <a name="Evaluate"></a> Evaluate block {{! expression [!]}}

Evaluate blocks do not inject content into the rendered document directly. But they can be used to change variable values etc.

* `expression` - A Javascript expression. It cannont contain any block types. Unlike an Interpolate block, the results of the expression of an Evaluate block are not rendered directly.

### <a name="Plugin"></a> Plugin block {{#name body[#]}}

Plugin blocks are ways to extend Kata functionality. You can define a plugin and include it as an option to kata().

* `name` - The name of the plugin as provided in options
* `body` - The body of the block, as specified by the plugin.

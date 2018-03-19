Kata
====

Generate HTML from Javascript template literal

## Install

````
$ yarn add kata
````

## Usage

kata relies on DOM APIs. It generates a single DOM node.


````js
import html from 'kata'

html`<div>Sample</div>`
````

## Embedding Javascript

````js
import html from 'kata'

let todos = [
  'Be nice'
  ,'Smile'
]

html`<span>${new Date().toDateString()}</span>
html`
  <div>
    ${todos.map(todo=>html`<div>${todo}</div>`)
  </div>
`
````

## Event Handlers

You can include event handlers in your template literal as expressions that evaluate to a function, like this:

````js
import html from 'kata'

function customHandler(){ alert('Clicked') }

html`<button onclick=${customHandler}>Click me</button>
html`<form onsubmit=${function(){alert(this.name.value)}}><input name="description"/></form>`
html`<button onclick=${()=>console.log(this, 'is not the button')}>Do something with this</button>`
````

## Multiple root nodes

Templates the include multiple root nodes generate a DocumentFragment containing those nodes.

````js
import html from 'kata'

html`
  <h1>Header</h1>
  <div>Subheader</div>
`
````

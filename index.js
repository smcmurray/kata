let re = / on([a-z]+)\s*=\s*(["'])?\s*?$/
  ,quote = {"'": /^\s*'/, '"': /^\s*"/}
  ,ehs = 'data-kata-ev'
  ,ecs = 'data-kata-embed'
  ,cf = /^data-kata-embed:(\d+)$/

export default function(s, ...expr){
  let e,embeds = []
      ,handlers = []
      ,predoc = ''
      ,strings = Array.from(s)
  for (let e of expr) {
    if ('function'===typeof e){
      predoc += strings.shift().replace(re, (_, event, q)=>{
        let i = handlers.push({event, handler:e})-1
        if (q && strings[0]){
          strings[0] = strings[0].replace(quote[q], '')
        }
        return ` ${ehs}="${i}"`
      })
    }
    else {
      predoc += strings.shift()
      for (let ae of [].concat(e)){
        if (('object' === typeof ae) && ('number' === typeof ae.nodeType) && [
          1 // Element
          ,3 // Text
          ,8 // Comment
          ,11 // DocumentFragment
        ].includes(ae.nodeType)){
          let i = embeds.push(ae)-1
          predoc += `<!--${ecs}:${i}-->`
        }
        else predoc += ae
      }
    }
  }
  predoc+=strings.shift()
  let doc = document.createRange().createContextualFragment(predoc.trim())
  doc.querySelectorAll(`*[${ehs}]`).forEach(e=>{
    let h = handlers[e.getAttribute(ehs)]
    e.addEventListener(h.event, h.handler)
    e.removeAttribute(ehs)
  })
  let m,n,walker = document.createNodeIterator(doc, NodeFilter.SHOW_COMMENT, { acceptNode: function(n){if (m = n.textContent.match(cf)) return NodeFilter.FILTER_ACCEPT} })
  while (n=walker.nextNode()) n.replaceWith(embeds[m[1]])
  return 1==doc.childNodes.length ? doc.firstChild : doc
}

let re = / on([a-z]+)\s*=\s*(["'])?\s*?$/
let quote = {"'": /^\s*'/, '"': /^\s*"/}

export default function(s, ...expr){
  let strings = Array.from(s)
  let predoc = ''
  let handlers = []
  let embeds = []
  for (let e of expr) {
    if ('function'===typeof e){
      predoc += strings.shift().replace(re, (_, event, q)=>{
        let i = handlers.push({event, handler:e})-1
        if (q && strings[0]){
          strings[0] = strings[0].replace(quote[q], '')
        }
        return ` data-event-handler-replacement="${i}"`
      })
    }
    else {
      predoc += strings.shift()
      for (let ae of Array.isArray(e) ? e : [e]){
        if ('string' === typeof ae){
          predoc += ae
        }
        else if (('object' === typeof ae) && ('number' === typeof ae.nodeType)){
          switch(ae.nodeType){
            case 1: // Element
            case 3: // Text
            case 8: // Comment
            case 11: // DocumentFragment
              let i = embeds.push(ae)-1
              predoc += `<div data-embedded-content-replacement="${i}"></div>`
          }
        }
        else {
          console.log('unknown chunk', ae)
        }
      }
    }
  }
  predoc+=strings.shift()
  let doc = document.createRange().createContextualFragment(predoc.trim())
  doc.querySelectorAll('*[data-event-handler-replacement]').forEach(e=>{
    let h = handlers[e.getAttribute('data-event-handler-replacement')]
    e.addEventListener(h.event, h.handler)
    e.removeAttribute('data-event-handler-replacement')
  })
  doc.querySelectorAll('*[data-embedded-content-replacement]').forEach(e=>{
    let c = embeds[e.getAttribute('data-embedded-content-replacement')]
    e.parentNode.insertBefore(c, e)
    e.parentNode.removeChild(e)
  })
  if (1==doc.childNodes.length) doc = doc.firstChild
  return doc
}

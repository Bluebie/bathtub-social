// Component implementing a Habbo-like chat log overlay
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const raw = require('nanohtml/raw')
const morph = require('nanomorph')
const parseDuration = require('parse-duration')
const ChatBubble = require('./component-chat-bubble')

// DEPRECATED
function renderChatLog() {
  // remove old messages
  while (chatLogComponents.length > 100) chatLogComponents.shift()
  // update chatlog
  morph(qs('.text-room-log'), html`<div class="text-room-log">${chatLogComponents.map(x => x.render())}</div>`)
  setTimeout(()=> qs('.text-room-log').scrollTop = 999999999)
}

class ChatLogComponent extends Nanocomponent {
  constructor({ onClick, expires } = {}) {
    super()
    this.onClick = onClick
    this.componentMap = new WeakMap()
    this.expires = parseDuration(expires || '1m')
    this.handleTextClick = this.handleTextClick.bind(this)
  }

  // handles clicks on appended text messages
  handleTextClick(event, chatBubble) {
    if (this.onClick) this.onClick(event, 'text', chatBubble)
  }

  // append a text message (ChatBubbleComponent under the hood) to the chat log
  appendText(person, text) {
    this.appendComponent(new ChatBubble({ person, text, onClick: this.handleTextClick }))
  }

  // append an arbitrary nanocomponent to the list
  appendComponent(component) {
    // render chat log widget
    let componentElement = component.render()
    this.element.append(componentElement)
    this.componentMap.set(componentElement, component)

    // setup expire counter
    setTimeout(async ()=> {
      console.log("time to expire")
      if (component.handleExpire) { await component.handleExpire() }
      console.log("expire function complete, removing element")
      component.element.remove()
    }, this.expires)
  }

  createElement() {
    return html`<div class="chat-log"></div>`
  }

  update() {
    //this.log.forEach(component => component.render())
    for (let element of this.element.children) {
      let component = this.componentMap.get(element)
      component.render()
    }
    return false
  }
}

module.exports = ChatLogComponent
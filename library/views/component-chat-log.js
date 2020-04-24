// Component implementing a Habbo-like chat log overlay
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const parseDuration = require('parse-duration')
const ChatBubble = require('./component-chat-bubble')
const delay = require('delay')
const Scroller = require('./util-scroll-smooth')

class ChatLogComponent extends Nanocomponent {
  // - onClick is called when a built in component is clicked on
  // - expires is how much time components stay on screen for
  // - duration is how long fade animations go for
  constructor({ onClick, expires, fadeDuration } = {}) {
    super()
    this.onClick = onClick
    this.componentMap = new WeakMap()
    this.expires = parseDuration(expires || '1m')
    this.fadeDuration = parseDuration(fadeDuration || '0.3s')
    this.handleTextClick = this.handleTextClick.bind(this)
  }

  // handles clicks on appended text messages
  handleTextClick(event, chatBubble) {
    if (this.onClick) this.onClick(event, 'text', chatBubble)
  }

  // append a text message (ChatBubbleComponent under the hood) to the chat log
  async appendText(person, text) {
    await this.appendComponent(new ChatBubble({ person, text, onClick: this.handleTextClick }))
  }

  // append an arbitrary nanocomponent to the list
  async appendComponent(component) {
    // add component to chat log widget
    let element = component.render()
    let container = html`<div class="chat-log-row">${element}</div>`
    this.componentMap.set(container, component)
    this.element.append(container)

    let d = this.fadeDuration
    console.log("height", container.offsetHeight)
    container.style['margin-top'] = `${container.offsetHeight}px`
    container.style['opacity'] = '0.0'
    container.style['overflow'] = 'hidden'
    await delay(50) // await page re-render so browser recomputes styles
    container.style['transition'] = `all ${d}ms linear`
    container.style['margin-top'] = '0em'
    container.style['opacity'] = '1.0'
    // animate the scroll down at the same time
    Scroller.animate({ target: this.element, direction: [container.offsetHeight, 0], duration: d + (1000 / 20) })

    await delay(this.fadeDuration) // wait for animation to complete

    // element is now in place. yay!
    await delay(this.expires) // wait however long components are supposed to last for in the log
    container.style['margin-top'] = `-${element.offsetHeight}px`
    container.style['opacity'] = '0.0'
    await delay(this.fadeDuration)

    container.remove()

    // scroll the view
    // let scroller = ()=> {
    //   this.element.scrollTop += 1
    //   if (this.element.scrollTop < this.element.scrollHeight - this.element.offsetHeight) {
    //     requestAnimationFrame(scroller)
    //   }
    // }

    // scroller()
  }

  // create the initial container element
  createElement() {
    return html`<div class="chat-log"></div>`
  }

  update() {
    // ask all the components to update if they feel like it
    for (let element of this.element.children) {
      let component = this.componentMap.get(element)
      if (component) component.render()
    }
    return false
  }
}

module.exports = ChatLogComponent
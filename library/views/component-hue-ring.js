// component renders a color wheel for selecting a hue
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const conicHues = `repeating-conic-gradient(${[360, 315, 270, 255, 180, 135, 90, 45, 0].map(hue => `hsl(${hue}, 100%, 50%)`).join(', ')})`
const morph = require('nanomorph')

class HueRingComponent extends Nanocomponent {
  constructor({ size, thickness, onChoice, hue } = {}) {
    super()
    this.size = size || "5em"
    this.thickness = thickness || "2.5ex"
    this.onChoice = onChoice || console.log
    this.hue = hue || 0
  }

  getHueFromEvent(event) {
    let midPoint = event.currentTarget.clientWidth / 2
    let xy = { x: event.offsetX - midPoint, y: event.offsetY - midPoint }
    return (((Math.atan2(xy.y, -xy.x) / Math.PI) * 180) + 90) % 360
  }

  onMouseMove(event) {
    this.hue = this.getHueFromEvent(event)
    morph(event.currentTarget, this.createElement())
  }

  onClick(event) {
    this.hue = this.getHueFromEvent(event)
    this.onChoice(this.hue)
  }

  createElement() {
    let styles = [
      `width: ${this.size}`,
      `height: ${this.size}`,
      `background-image: ${conicHues}`,
      `box-shadow: 1px 2px 5px 1px hsla(0, 0%, 0%, 20%)`,
      `border-radius: calc(${this.size} / 2)`,
      `padding: ${this.thickness};`,
      `z-index: 1000`,
      `position: absolute`,
      `box-sizing: border-box`,
    ]

    let innerStyles = [
      `width: calc(${this.size} - (${this.thickness} * 2))`,
      `height: calc(${this.size} - (${this.thickness} * 2))`,
      `background-color: hsl(${this.hue}, 100%, 50%)`,
      `border-radius: calc((${this.size} - (${this.thickness} * 2)) / 2)`,
      `box-shadow: inset 0.5px 1px 5px 2px hsla(0, 0%, 0%, 20%)`,
      `box-sizing: border-box`
    ]
    return html`<div class="hue-ring-component" style="${styles.join(';\n')}" onclick=${(event)=> this.onClick(event)} onmousemove=${(event)=> this.onMouseMove(event)}>
      <div class="hue-ring-selected" style="${innerStyles.join(';\n')}"></div>
    </div>`
  }

  update() {
    return JSON.stringify([this.room.getPerson(this.identity), this.text]) != this.cache
  }
}

module.exports = HueRingComponent
// component renders a color wheel for selecting a hue
const html = require('nanohtml')
const css = require('sheetify')
const mouseOffset = require('mouse-event-offset')
const elementOn = require('element-on')

const prefix = css`
  :host {
    --mid-point: calc(var(--size) / 2);
    background-image: repeating-conic-gradient(hsl(360, 100%, 50%), hsl(315, 100%, 50%), hsl(270, 100%, 50%), hsl(255, 100%, 50%), hsl(180, 100%, 50%), hsl(135, 100%, 50%), hsl(90, 100%, 50%), hsl(45, 100%, 50%), hsl(0, 100%, 50%));
    position: absolute; left: calc(var(--x) - var(--mid-point)); top: calc(var(--y) - var(--mid-point));
    width: var(--size); height: var(--size);
    z-index: 1000;
    border-radius: var(--mid-point);
    box-shadow:
      1px 2px 5px 1px hsla(0, 0%, 0%, 20%),
      0 0.75px 1.5px 1px hsla(0, 0%, 0%, 50%),
      inset 1px calc(var(--thickness) *  0.4) calc(var(--thickness) * 0.4) hsla(0, 0%, 100%, 40%),
      inset 1px calc(var(--thickness) * -0.4) calc(var(--thickness) * 0.4) hsla(0, 0%, 0%, 40%);
    opacity: 0.0;
    transform: scale(0.0);
    box-sizing: border-box;
    
    transition: transform var(--speed), opacity var(--speed);
  }

  :host.visible {
    opacity: 1.0;
    transform: scale(1.0);
  }

  :host .hue-ring-selected {
    --inner-size: calc(var(--size) - (var(--thickness) * 2));
    --inner-mid-point: calc(var(--mid-point) - var(--thickness)); 
    width: var(--inner-size); height: var(--inner-size);
    background-color: hsl(var(--hue), 100%, 50%);
    margin: var(--thickness);
    border-radius: var(--inner-mid-point);
    box-shadow:
      inset 0.5px 1px 5px 2px hsla(0, 0%, 0%, 20%),
      1px calc(var(--thickness) *  0.4) calc(var(--thickness) * 0.4) hsla(0, 0%, 100%, 40%),
      1px calc(var(--thickness) * -0.4) calc(var(--thickness) * 0.4) hsla(0, 0%, 0%, 40%);
    box-sizing: border-box;
  }
`

class HueRingWidget {
  constructor({ size, thickness, onChoice, hue, position, speed } = {}) {
    this.size = size || "5em"
    this.thickness = thickness || "2.5ex"
    this.onChoice = onChoice || console.log
    this.hue = hue || 0
    this.position = position || { x: 50, y: 50 }
    this.speed = speed || "0.25s"
    
    if (this.position.pageX) this.position = { x: this.position.pageX, y: this.position.pageY }
    
    this.element = this.createElement()
    document.body.append(this.element)
    setTimeout(()=> this.element.classList.add("visible"))
  }

  getHueFromEvent(event) {
    let midPoint = event.currentTarget.clientWidth / 2
    let [mX, mY] = mouseOffset(event)
    let xy = { x: mX - midPoint, y: mY - midPoint }
    return (((Math.atan2(xy.y, -xy.x) / Math.PI) * 180) + 450) % 360
  }

  onMouseMove(event) {
    this.hue = this.getHueFromEvent(event)
    this.element.style.setProperty('--hue', `${this.hue}`)
  }

  onClick() {
    this.onChoice(this.hue)
    this.destroy()
  }

  async destroy() {
    this.element.classList.remove("visible")
    await elementOn(this.element, 'transitionend')
    this.element.remove()
  }

  createElement() {
    let vars = {
      size: this.size,
      thickness: this.thickness,
      hue: this.hue,
      x: `${this.position.x}px`,
      y: `${this.position.y}px`,
      speed: this.speed,
    }

    let style = Object.entries(vars).map(([a,b]) => `--${a}:${b};`).join('')
    return html`<div class="${prefix} hue-ring-component" style="${style}" onclick=${(event)=> this.onClick(event)} onmousemove=${(event)=> this.onMouseMove(event)}>
      <div class="hue-ring-selected"></div>
    </div>`
  }
}

module.exports = HueRingWidget
// utility to scroll an Element's contents for a duration by an amount
const parseDuration = require('parse-duration')

class Scroller {
  constructor({ target, duration, property, direction }) {
    this.target = target
    this.progress = 0.0
    this.duration = duration
    this.direction = direction
    this.property = property || 'scrollTop'
    this.onScroll = this.onScroll.bind(this)
    this.cancel = false
  }

  onScroll() {
    this.cancel = true
  }

  isFinished() {
    return this.progress >= 1.0 || this.cancel
  }

  start() {
    //this.lastTick = Date.now()
    console.log("Start scrolltop", this.startValue = this.target.scrollTop)
    this.remainders = [0, 0]

    //this.target.addEventListener('scroll', this.onScroll)
    requestAnimationFrame((time) => {
      this.lastTime = time - (1000 / 60) // rough guess at what the difference would be
      this.tick(time)
    })
    return this
  }

  tick(time) {
    if (this.cancel) return
    let timestep = time - this.lastTime
    this.lastTime = time
    this.progress += timestep / this.duration
    let adjustment = this.direction.map((d, i) => (d * (timestep / this.duration)) + this.remainders[i])
    let integers = adjustment.map(Math.round)
    this.remainders = adjustment.map((v, i) => v - integers[i])

    this.target.scrollTop  += integers[0]
    this.target.scrollLeft += integers[1]
    if (this.isFinished()) {
      //this.target.removeEventListener('scroll', this.onScroll)
      console.log("End scrollTop", this.target.scrollTop, "difference", this.target.scrollTop - this.startValue, "goal", this.direction)
    } else {
      requestAnimationFrame((time)=> this.tick(time))
    }
  }
}

Scroller.animate = (opts)=> {
  return (new Scroller(opts)).start()
}

module.exports = Scroller
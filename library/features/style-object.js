// very simple object, which, when converted to a string, turns in to a css inline style representation of itself
// if a value is set to a function, the function will be executed every time the style is converted to string
const inlineStyle = require('inline-style')
class StyleObject {
  constructor(initial) {
    if (initial) {
      this.set(initial)
    }
  }

  // set CSS properties in bulk
  set(obj) {
    Object.entries(obj).forEach(([key, value])=> this[key] = value)
  }

  // set CSS variables (with -- prefix added) in bulk
  setVariables(obj) {
    Object.entries(obj).forEach(([key, value])=> this[`--${key}`] = value)
  }

  toString() {
    let entries = Object.entries(this)
    let calculated = entries.map(([key, value])=> {
      if (typeof(value) == 'function') value = value()
      if (Array.isArray(value)) value = value.filter(x => x !== null).join(', ')
      return [key, value]
    }).filter(([key, value])=> value !== undefined && value !== null)
    return inlineStyle(Object.fromEntries(calculated))
  }
}

module.exports = StyleObject
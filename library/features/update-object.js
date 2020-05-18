// accepts an object, returns the same original object, modified with the updates list provided
// updates list must be an array of [["property","path"], newValue] entries

module.exports = function updateObject(person, updates) {
  updates.forEach(([inputPath, value])=> {
    // support for 'path.to.property' style input paths
    if (typeof(inputPath) === 'string') inputPath = inputPath.split('.')
    
    let path = [...inputPath]
    let object = person
    let finalKey = path.pop()
    path.forEach(key => object = object[key])
    if (value !== undefined) {
      object[finalKey] = value
    } else {
      delete object[finalKey]
    }
  })
}
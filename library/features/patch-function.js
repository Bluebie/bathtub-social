const jsonMergePatch = require('json-merge-patch')

// accepts a function, which is called with a clone of the object to be patched
// and when the function is done running, changes it made to it's cloned object
// generate a JSON Merge Patch (RFC 7396) patch, which is returned
// if something other than a modifier function is provided, it is simply returned
// and assumed to be a patch object itself
// if modifier function returns a Promise, patchFunction will return one too and resolve
// later, so patchFunction effectively works syncronously if possible, which should be
// consistent when using async/await
function patchFunction(target, modifier) {
  if (typeof(modifier) !== 'function') return modifier

  let clone = JSON.parse(JSON.stringify(target))
  let result = modifier(clone)
  if (result instanceof Promise) {
    return new Promise((resolve, reject) => {
      result
        .then(()=> resolve(jsonMergePatch.generate(target, clone)))
        .catch((reason)=> reject(reason))
    })
  } else {
    return jsonMergePatch.generate(target, clone)
  }
}

module.exports = patchFunction
// all available frontend views
const views = [
  require('./views/view-text-room'),
  require('./views/view-room'),
]

window.bathtub = {}
async function run() {
  let viewConfig = JSON.parse(document.getElementById('bathtub-bundle').dataset.view)
  let ViewClass = views.find((obj)=> obj.name == viewConfig.view)
  if (ViewClass) {
    bathtub.view = new ViewClass(viewConfig.options)
    // replace the body with a client side rendered view using the same server side render initialisation data
    document.body.replaceWith(bathtub.view.render())
  } else {
    console.info(`Server Side rendered view "${viewConfig.view}" not available locally to revive client side`)
  }
}

window.onload = run
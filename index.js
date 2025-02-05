const express = require('express')
const config = require('./package.json').bathtub
const process = require('process')

// rebuild static site
const buildStaticSite = require('./library/build-static-site')

var app = express()
app.disable('x-powered-by') // lets not waste that bandwidth


if (config.development) {
  // logger
  app.use((req, res, next) => {
    console.info(req.method + ': ' + req.originalUrl)
    next()
  })
  // serve live styles folder
  app.use('/style', express.static('./style'))
  app.use('/configuration', express.static('./configuration'))
  app.use('/library', express.static('./library'))

  // dynamically rebuild bundle on request for development
  app.get('/bundle.js', async (req,res)=> {
    res.set('Content-Type', 'application/javascript')
    res.send(await buildStaticSite.devBundle())
  })
} else {
  buildStaticSite()
}

// add route handlers for /room API
app.use('/rooms', require('./library/server-routes/route-rooms.js'))
app.use('/config', require('./library/server-routes/route-config.js'))

// add static server support in case there's no front end proxy during development
//app.use(express.static('./build'))

app.listen(process.env.SERVER_PORT || config.appServerPort || 5156)

process.stdin.on("data", ()=> {
  console.log("Terminating...")
  process.exit()
})
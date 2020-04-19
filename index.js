const express = require('express')
const config = require('./package.json').bathtub

// rebuild static site
const buildStaticSite = require('./library/build-static-site')
buildStaticSite()

var app = express()
app.disable('x-powered-by') // lets not waste that bandwidth


if (config.development) {
  // logger
  app.use((req, res, next) => {
    console.log(req.method + ': ' + req.originalUrl)
    next()
  })
  // serve live styles folder
  app.get('/style', express.static('./style'))
  // dynamically rebuild bundle on request for development
  app.get('/bundle.js', async (req,res)=> {
    res.set('Content-Type', 'application/javascript')
    res.send(await buildStaticSite.devBundle())
  })
}

// add route handlers for /room API
app.use('/rooms', require('./library/server-routes/route-room.js'))

// add static server support in case there's no front end proxy during development
app.use(express.static('./build'))

app.listen(8080)
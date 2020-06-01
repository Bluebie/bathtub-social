const fs = require('fs-extra')
const appRoot = require('app-root-path')
const PQueue = require('p-queue').default
const parseDuration = require('parse-duraton')

const wholeDay = parseDuration('1d')

class AuditLog {
  constructor(path, config = {}) {
    this.path = path
    this.config = {
      maxAge: '30d',
      ...config
    }
    this.queue = new PQueue({ concurrency: 1 })
    // trim the log file on startup
    this.trim()
  }

  // appends a message to the log
  async log(type, actor, message) {
    await this.queue.add(async ()=> {
      await fs.appendFile(this.path, JSON.stringify({
        type, actor, message,
        timestamp: Date.now()
      }) + "\n")
    })

    // if there hasn't been a log trim in a full day, trim it
    if (Date.now() > Math.abs(this.lastTrim) + wholeDay) {
      this.trim()
    }
  }

  // rebuilds the log with old messages removed
  async trim() {
    await this.queue.add(async ()=> {
      this.lastTrim = Date.now()
      let lines = await fs.readFile(this.path).split("\n")
      let cutoff = Date.now() - parseDuration(this.config.maxAge)
      let index = lines.findIndex(x => x.trim().length > 0 && JSON.parse(x).timestamp > cutoff)
      if (index == -1) index = lines.length
      await fs.writeFile(this.path, lines.slice(index).join("\n"))
    })
  }
}

let singleton = new AuditLog(appRoot.resolve('/configuration/audit-log.txt'))

module.exports = singleton
const EventEmitter = require('events')
const parseDuration = require('parse-duration')
const randomUUID = require('uuid').v4

class SubscriptionLog extends EventEmitter {
  constructor({expire, maxSubscribers}) {
    super()
    this.expire = parseDuration(expire || '1m')
    this.log = []
    this.setMaxListeners(maxSubscribers) // emits warnings to console when this limit is exceeded
  }

  // append a piece of data to the log
  append(messageType, data) {
    let entry = { uuid: randomUUID(), messageType, data, timestamp: Date.now() }
    this.log.push(entry)
    this.emit('append', entry)
    this.garbageCollect()
    return entry
  }

  // return an array of events that have occured since this UUID, to catch up to the stream
  // if the UUID has expired and been removed, returns false instead
  since(uuid) {
    let idx = this.log.findIndex(item => item.uuid == uuid)
    if (idx === -1) return false
    return this.log.slice(idx + 1)
  }

  // check if uuid exists in the log, true if it does, false if it's expired or never been present
  has(uuid) {
    return this.log.some(entry => entry.uuid == uuid)
  }

  // remove expired items from the log
  garbageCollect() {
    let expireTimestamp = Date.now() - this.expire
    while (this.log[0] && this.log[0].timestamp < expireTimestamp) {
      this.log.shift()
    }
  }
}

module.exports = SubscriptionLog
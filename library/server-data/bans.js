// Authorities is a singleton object which keeps track of which keys allow access to adaministrator
// and moderator functions
const fs = require('fs-extra')
const appRoot = require('app-root-path')
const PQueue = require('p-queue').default
const prettyMs = require('pretty-ms')
const parseDuration = require('parse-duration')
const uuid = require('uuid').v4

class Bans {
  constructor(dataPath) {
    this.dataPath = dataPath || appRoot.resolve('/configuration/bans.json')
    this.data = fs.readJSONSync(this.dataPath)
    this.writeQueue = new PQueue({ concurrency: 1 })
    this.recalculate()
  }

  recalculate() {
    this.lastBan = Math.max(...this.data.map(x => x.timestamp))
    this.bannedIPs = {}
    this.bannedIdentities = {}
    let now = Date.now()
    for (let entry of this.data) {
      if (entry.expires > now) {
        entry.IPs.forEach(x => this.bannedIPs[x.toLowerCase()] = entry)
        entry.identities.forEach(x => this.bannedIdentities[x.toLowerCase()] = entry)
      }
    }
  }

  // store the current state to a file, removing any expired bans
  save() {
    let now = Date.now()
    this.writeQueue.add(()=> fs.writeJSON(this.dataPath, this.data.filter(ban => {
      return ban.expires > now
    })))
  }

  // returns an array of objects containing info about registered authority keys
  list() {
    return this.data
  }

  // checks if an Express-style request is from a banned user
  getBan(req) {
    let ban = this.bannedIPs[req.ip.toLowerCase()]
    if (!ban && req.sig && req.sig.identity && req.sig.valid) {
      ban = this.bannedIdentities[req.sig.identity.toLowerCase()]
    }

    if (ban && ban.expires < Date.now()) {
      this.unban(ban)
      return false
    }

    return ban || false
  }

  // Express middleware to detect banned users and block their access to services
  bannedMiddleware() {
    return (req, res, next)=> {
      let ban = this.getBan(req)
      if (ban) {
        res.status(403).send({
          error: `You are banned, because: "${ban.reason}", for this much longer: ${prettyMs(ban.expires - Date.now(), {verbose: true})}`,
          errorType: "ban"
        })
        // to frustrate lazy attempts at ban evasion:
        let expanded = false
        // if they changed to a different IP, add it to the ban
        if (!ban.IPs.includes(req.ip)) {
          ban.IPs.push(req.ip)
          expanded = true
        }
        // if they built a new identity but kept the same IP, add it to the ban
        if (!ban.identities.includes(req.sig.identity)) {
          ban.identities.push(req.sig.identity)
          expanded = true
        }
        // if we found new identifiers, update our ban model and save out updated ban info to disk
        if (expanded) {
          this.recalculate()
          this.save()
        }
      } else {
        next()
      }
    }
  }

  // ban whoever made this request
  ban(identity, { reason, duration, authority }) {
    let now = Date.now()
    this.data.push({
      identities: [identity], //  just ban their crypto identity for now
      IPs: [], // next time this user contacts the server their IP will be added to the ban too
      reason: reason || "No reason given",
      timestamp: now,
      expires: now + parseDuration(duration),
      uuid: uuid(),
      authority,
    })
    this.recalculate()
    this.save()
  }

  // unban an entry from this.list() or this.getBan()
  unban(uuid) {
    this.data = this.data.filter(x => x != banEntry)
    this.recalculate()
    this.save()
  }
}

let singleton = new Bans

module.exports = singleton
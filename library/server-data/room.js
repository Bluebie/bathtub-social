// Server Side representation of a Room, which holds the shared append only log of events
// and a current state, as well as meta information about architecture and stuff like that
const appRoot = require('app-root-path')
const SubscriptionLog = require('./subscription-log')
const config = require('../../package.json').bathtub
const jsonPatch = require('json-merge-patch')
const patchFunction = require('../features/patch-function')
const fs = require('fs-extra')
const bytes = require('bytes')
const imageSize = require('image-size')

class Room {
  constructor(config) {
    this.roomID = config.roomID
    this.architectureName = config.architecture
    this.architecture = fs.readJSONSync(appRoot.resolve(`/configuration/architectures/${this.architectureName}/config.json`))
    this.people = {}
    this.humanName = config.humanName
    this.maxPeople = config.maxPeople
    this.links = config.links
    // setup append only subscribable log
    this.log = new SubscriptionLog({ expire: config.expire, maxSubscribers: this.maxPeople * 2 })
    this.log.on('append', (entry)=> this.processAppend(entry))

    // augment architecture with image sizes on layers
    if (this.architecture.layers) {
      this.architecture.layers.forEach(layer => {
        let info = imageSize(appRoot.resolve(`/configuration/architectures/${this.architectureName}/${layer.image}`))
        layer.info = info
      })
    }
  }

  // returns public stats and info about the room, for inclusion in room listings
  getPublicInfo() {
    return {
      roomID: this.roomID,
      humanName: this.humanName,
      maxPeople: this.maxPeople,
      headCount: Object.keys(this.people).length,
    }
  }

  // returns a JSON serializable object, representing everything about this room
  getStateData() {
    return {
      roomID: this.roomID,
      humanName: this.humanName,
      architecture: this.architecture,
      architectureName: this.architectureName,
      people: Object.values(this.people),
      maxPeople: this.maxPeople,
      links: this.links,
    }
  }

  personJoin(identity, personConfig) {
    // setup person object
    let person = {
      attributes: {},
      ...personConfig,
      identity,
      avatar: {},
      joined: Date.now(),
    }

    if (JSON.stringify(person.attributes).length > bytes.parse(config.personAttributesMaxSize)) {
      throw new Error("Person Object is too large!")
    }

    // append to log
    if (Object.keys(this.people).length < this.maxPeople) {
      this.log.append('personJoin', person)
    } else {
      throw new Error('Room is full')
    }

    return person
  }

  // person can be altered
  // identity must be a base64 identity publicKey
  // updates must be either a plain object, in the JSON Merge Patch (RFC 7396) format
  //  - or it can be a callback function, which recieves a clone of the person object to modify
  //    and automatically generates a JSON Merge Patch
  personChange(identity, updates = {}) {
    let person = this.getPerson(identity)
    if (!person) throw new Error("This person isn't in the room")

    // if the update argument is a function, call it and generate a JSON Patch from it's modifications to the object
    updates = patchFunction(person, updates)

    // test the update to verify person object doesn't get too big
    let clone = JSON.parse(JSON.stringify(person))
    jsonPatch.apply(clone, updates)
    if (JSON.stringify(clone.attributes).length > bytes.parse(config.personAttributesMaxSize)) {
      throw new Error("Person Object's attributes property would grow too large! Cannot accept update")
    }

    this.log.append('personChange', { identity, updates })
  }

  // eventually remove person from room
  personLeave(identity) {
    if (!this.getPerson(identity)) throw new Error("You aren't in this room.")
    this.log.append('personLeave', { identity })
  }

  getPerson(identity) {
    return this.people[identity]
  }

  // update room architecture to a different design
  setArchitecture(architecture) {
    this.log.append('roomChange', { architecture })
  }

  // send a message to the room, if it has a "to" property containing a base64 public key, it is delivered only
  // to that recipient, otherwise it is broadcast
  send(identity, messageObject) {
    this.log.append('message', { ...messageObject, identity })
  }

  // INTERNAL: called to process new entries in the log, update local state to reflect appends
  processAppend({ messageType, data }) {
    if (messageType == 'personJoin') {
      // when a person joins, add their data to the person collection
      if (!this.getPerson(data.identity)) this.people[data.identity] = data

    } else if (messageType == 'personLeave') {
      // when a person leaves, remove any people with matching identity
      delete this.people[data.identity]

    } else if (messageType == 'personChange') {
      // when a person updates their attributes, or metadata about a person like their privilages change, update that record
      let person = this.getPerson(data.identity)
      if (!person) throw new Error(`No person exists with public key identity string ${data.identity}`)

      // apply patches to person object so server has up to date user state
      jsonPatch.apply(person, data.updates)

    } else if (messageType == 'roomChange') {
      if (data.architecture) this.architecture = data.architecture
      if (data.roomID) this.roomID = data.roomID
    }
  }
}

module.exports = Room
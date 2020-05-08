// Server Side representation of a Room, which holds the shared append only log of events
// and a current state, as well as meta information about architecture and stuff like that
const SubscriptionLog = require('./subscription-log')
const config = require('../../package.json').bathtub

function updateObject(person, updates) {
  updates.forEach(([path, value])=> {
    let object = person
    let finalKey = path.pop()
    path.forEach(key => object = object[key])
    object[finalKey] = value
  })
}

class Room {
  constructor(config) {
    this.roomID = config.roomID
    this.architecture = config.architecture
    this.people = {}
    this.maxPeople = config.maxPeople
    // setup append only subscribable log
    this.log = new SubscriptionLog({ expire: config.expire, maxSubscribers: this.maxPeople * 2 })
    this.log.on('append', (entry)=> this.processAppend(entry))
  }

  // returns public stats and info about the room, for inclusion in room listings
  getPublicInfo() {
    return {
      roomID: this.roomID,
      architecture: this.architecture,
      maxPeople: this.maxPeople,
      headCount: Object.keys(this.people).length,
    }
  }

  // returns a JSON serializable object, representing everything about this room
  getStateData() {
    return {
      roomID: this.roomID,
      architecture: this.architecture,
      people: Object.values(this.people),
      maxPeople: this.maxPeople,
    }
  }

  personJoin(identity, personConfig) {
    // setup person object
    let person = {
      attributes: {},
      ...personConfig,
      identity,
      joined: Date.now(),
    }

    if (JSON.stringify(person).length > config.personObjectMaxSize) {
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
  personChange(identity, updates = []) {
    let person = this.getPerson(identity)
    if (!person) throw new Error("This person isn't in the room")

    // test the update to verify person object doesn't get too big
    let clone = JSON.parse(JSON.stringify(this.getPerson(person)))
    updateObject(clone, updates)
    if (JSON.stringify(clone).length > config.personObjectMaxSize) {
      throw new Error("Person Object would grow too large! Cannot accept update")
    }

    this.log.append('personChange', { identity, updates })
  }

  // work out how large the person's object will be if some updates are applied
  sizeOfPersonChange(identity, updates = []) {

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

      // follow the path specified in each update entry and write over it's value
      updateObject(person, data.updates)

    } else if (messageType == 'roomChange') {
      if (data.architecture) this.architecture = data.architecture
      if (data.roomID) this.roomID = data.roomID
    }
  }
}

module.exports = Room
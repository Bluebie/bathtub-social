const EventEmitter = require('events')
const Identity = require('../crypto/identity')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const updateObject = require('../features/update-object')
const config = require('../../package.json').bathtub
// ensure fetch is available
require('isomorphic-fetch')

// room connects to a server side room and maintains a state consistent with the server side view
// as well as provides an API to do actions, and emits events:
// - personJoin - passes the raw person object from the server
// - personLeave - passes the person object that will be removed soon
// - personChange - passes the person object, and the new properties
// - peopleChange - fires whenever anything about the people list updates, passing this object
// - p2p - fires when you recieve a direct message from another users
class RoomClient extends EventEmitter {
  constructor(init) {
    super()
    this.identity = init.identity
    this.roomID = init.roomID
    this.humanName = init.humanName
    this.architecture = init.architecture
    this.architectureName = init.architectureName
    this.architecturePath = config.apiRoot + uri`/configuration/architectures/${this.architectureName}`
    this.people = {}
    this.maxPeople = init.maxPeople
    this.links = init.links
    this.sse = null
  }

  // join the room, connecting the event source, with optional initial attributes values
  async join(personAttributes = {}) {
    if (!this.identity) this.identity = new Identity()
    if (!this.sse) {
      let ssePath = config.apiRoot + uri`/rooms/${this.roomID}/event-stream`
      let requestPath = this.identity.signedQueryString(ssePath, { attributes: personAttributes || {} })

      this.sse = new EventSource(requestPath)
      this.sse.onmessage = ({data}) => {
        let message = JSON.parse(data)
        if (this[`_message_${message.messageType}`]) {
          this[`_message_${message.messageType}`](message.data)
        } else {
          console.info(`Unhandled server sent event:`, message)
        }
      }
    }
  }

  // update shared attributes for this user
  // accepts either a structured array:
  // [
  //   [['path','to','property'], newValue],
  //   [['path','to','otherProperty'], newValue2]
  // ]
  // or object form:
  // {
  //   "path.to.property": newValue,
  //   "path.to.otherProperty": newValue2
  // }
  // All updates will be applied to the attributes object of this user as the root object.
  // client cannot overwrite properties above that level. All data in person.attributes should
  // be assumed to be user generated
  async updateAttributes(personAttributes) {
    let updates = personAttributes
    if (!Array.isArray(updates)) {
      updates = Object.entries(updates).map(([key, value])=> 
        [key.split('.'), value]
      )
    }
    let response = await this.postJSON(uri`/rooms/${this.roomID}/set-attributes`, { updates })
    if (response.error) throw new Error(response.error)
    else if (response.success) return true
  }

  // upload an avatar
  async uploadAvatar(avatarBuffer) {
    let apiPath = uri`/rooms/${this.roomID}/avatar`
    let response = await this.identity.signedFetch(`${config.apiRoot}${apiPath}`, {
      mode: 'same-origin',
      cache: 'no-cache',
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: avatarBuffer,
    })
    return await response.json()
  }

  // get a person from their base64 publickey identity string
  getPerson(identity) {
    return this.people[identity]
  }

  // returns your own person from the people collection
  get myself() { return this.getPerson(this.identity.base64.publicKey) }

  // leave this room
  async leave() {
    this.sse.close() // stop the eventstream

    let message = { leave: true }
    // with keepalive so leave events work even if fired during page navigation events
    let response = await this.postJSON(uri`/rooms/${this.roomID}/leave`, message, { keepalive: true })
    if (response.error) throw new Error(response.error)
    else if (response.success) return true
  }

  // send a text message
  async text(textMessage) {
    return this.broadcast({
      type: "text", message: textMessage.toString()
    })
  }

  // send an emote to your avatar in the room
  async emote(emoteName) {
    return this.broadcast({
      type: "emote", emoteID: emoteName.toString()
    })
  }

  // send a direct message to another user (i.e. for establishing a webrtc connection)
  async dm(toIdentity, message) {
    let response = await this.postJSON(uri`/rooms/${this.roomID}/send`, { ...message, to: toIdentity })
    if (response.error) throw new Error(response.error)
    else if (response.success) return true
  }

  // broadcast arbitrary information to the room
  async broadcast(message) {
    let response = await this.postJSON(uri`/rooms/${this.roomID}/send`, message)
    if (response.error) throw new Error(response.error)
    else if (response.success) return true
  }

  // GETs a json response from a GET capable API
  async getJSON(apiPath, options = {}) {
    let pathname = `${config.apiRoot}${apiPath}`
    let response = await this.identity.signedFetch(pathname, {
      cache: 'no-cache', mode: 'same-origin', ...options
    })
    return await response.json()
  }

  // POSTs a signed request to a POST capable API
  async postJSON(apiPath, message, options = {}) {
    let json = JSON.stringify(message)
    let pathname = `${config.apiRoot}${apiPath}`
    let response = await this.identity.signedFetch(pathname, {
      mode: 'same-origin',
      cache: 'no-cache',
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: json,
    })
    return await response.json()
  }


  ////// Handlers for processing server sent events \\\\\\\
  // initial room state snapshot sets current state
  _message_roomState(message) {
    this.roomID = message.roomID
    this.humanName = message.humanName
    this.maxPeople = message.maxPeople
    this.architecture = message.architecture
    this.architectureName = message.architectureName
    this.architecturePath = config.apiRoot + uri`/configuration/architectures/${this.architectureName}`
    this.links = message.links
    
    // for any new or updated people, insert/update them in to the person object
    message.people.forEach(person => {
      if (this.people[person.identity]) {
        // remove all properties
        Object.keys(this.people[person.identity]).forEach(key => { delete this.people[person.identity][key] })
        // set all updated properties
        Object.entries(person).forEach(([key, value]) => { this.people[person.identity][key] = value })
        this.emit('personChange', this.people[person.identity])
      } else {
        this.people[person.identity] = person
        this.emit('personJoin', this.people[person.identity])
      }
    })
    // for any missing people, emit personLeave events and remove them from the local list
    Object.keys(this.people).forEach(id => {
      if (!message.people.some(x => x.identity == id)) {
        this.emit('personLeave', this.people[id])
        delete this.people[id]
      }
    })

    this.emit('peopleChange', this)
    this.emit('reloaded')
  }

  // when a person joins, add them to the people list
  _message_personJoin(message) {
    if (this.getPerson(message.identity)) return console.error(`Recieved personJoin event from existing person`, message)
    let person = this.people[message.identity] = message
    this.emit('personJoin', person)
    this.emit('peopleChange', this)
  }

  // when a person leaves, remove them from the people list
  _message_personLeave({ identity }) {
    let person = this.people[identity]
    if (!person) return console.error(`Recieved personLeave event from unknown person`, message)
    delete this.people[identity]
    this.emit('personLeave', person)
    this.emit('peopleChange', this)
  }

  // when a detail about a person has been updated
  _message_personChange(message) {
    let person = this.getPerson(message.identity)
    if (!person) return console.error(`Recieved personChange event from unknown person`, message)
    // for each update, resolve the path and overwrite the updated value
    updateObject(person, message.updates)

    this.emit('personChange', person)
    this.emit('peopleChange', this)
  }

  // when a broadcast (room-wide) message is distributed
  _message_message(message) {
    console.log('message', message)
    if (message.to) this.emit('dm', message)
    else this.emit('broadcast', message)
    if (message.type == 'text') this.emit('text', message)
    else if (message.type == 'emote') this.emit('emote', message)
    else if (message.type == 'signal') this.emit('signal', message)
  }
}


// fetches a list of all existing rooms on the server, eventually returns an array of RoomClients
RoomClient.getRooms = async ({ identity }) => {
  let response = await fetch(`${config.apiRoot}/rooms/`, { cache: 'no-cache', 'mode': 'same-origin' })
  let list = await response.json()
  return list.map(info => new RoomClient({ ...info, identity }))
}

// fetches a room, prepopulated with information like architecture
RoomClient.getRoom = async ({ identity, roomID }) => {
  let response = await fetch(config.apiRoot + uri`/rooms/${roomID}`, { cache: 'no-cache', 'mode': 'same-origin' })
  let info = await response.json()
  return new RoomClient({ roomID, ...info, identity })
}

module.exports = RoomClient
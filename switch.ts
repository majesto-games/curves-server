import * as events from "events"
const Loki = require("lokijs")

interface Board extends events.EventEmitter {
  rooms: any,
  room: any,
  id: any,
  process: any,
  leave: any,
  connect: any,
  destroy: any,
  reset: any,
}

function jsonparse(input: any) {
  try {
    return JSON.parse(input)
  } catch (e) {
    return input
  }
}

export  function createBoard(): Board {
  const board = new events.EventEmitter() as Board
  const db = new Loki()
  const rooms = board.rooms = db.addCollection("rooms", {
    unique: ["name"],
    indices: ["memberCount"],
  })

  function connect() {
    const peer = new events.EventEmitter() as Board

    function process(data: any) {
      // emit the data for the board to process
      board.emit("data", data, peer && peer.id, peer)

      if (data.charAt(0) === "/") {
        const command = data.slice(1, data.indexOf("|", 1)).toLowerCase()

        // split data and parse the parts
        const parts = data.slice(command.length + 2).split("|").map(jsonparse)

        switch (command) {
          case "to": {
            const idPart = parts[0]
            const target = peer.room && peer.room.members.find((member: any) => member.id === idPart)

            if (target) {
              target.emit("data", data)
            } else {
              console.warn(`got a to request for id "${idPart}" but cannot find target`)
            }

            break
          }
          default: {
            board.emit.apply(board, [command, data, peer].concat(parts))

            if (peer.room) {
              peer.room.members.filter((p: any) => p !== peer).forEach(function (member: any) {
                member.emit("data", data)
              })
            }
          }
        }
      }
    }

    // add peer functions
    peer.process = process
    peer.leave = board.emit.bind(board, "leave", peer)

    // trigger the peer connect
    board.emit("peer:connect", peer)

    return peer
  }

  function createRoom(name: any) {
    // create a simple room object
    rooms.insert({
      name,
      memberCount: 0,
      members: [],
    })

    board.emit("room:create", name)
    return rooms.by("name", name)
  }

  function destroy() {
    rooms.clear()
  }

  function getOrCreateRoom(name: any) {
    return rooms.by("name", name) || createRoom(name)
  }

  // handle announce messages
  board.on("announce", function (payload: any, peer: any, sender: any, data: any) {
    const targetRoom = data && data.room
    const room = targetRoom && getOrCreateRoom(targetRoom)

    // a peer can only be in one room at a time
    // trigger a leave command if the peer joins a new room
    if (peer.room && peer.room.name !== targetRoom) {
      board.emit("leave", peer, sender, data)
    }

    // tag the peer
    peer.room = room
    peer.id = data.id

    if (room) {
      // add the peer to the room
      room.members = room.members.filter((member: any) => member.id !== peer.id).concat([peer])

      room.memberCount = room.members.length

      // store the update in the db
      rooms.update(room)

      // send the number of members back to the peer
      peer.emit("data", `/roominfo|{"memberCount":${room.members.length}}`)
    }
  })

  board.on("leave", function (peer: any) {
    if (peer.room) {
      // remove the peer from the room
      peer.room.members = peer.room.members.filter((p: any) => p !== peer)

      // if we have no more members in the room, then destroy the room
      if (peer.room.members.length === 0) {
        board.emit("room:destroy", peer.room.name)
        rooms.remove(peer.room)
      } else {
        // store the update in the db
        rooms.update(peer.room)
      }

      peer.room = null
    }

    board.emit("peer:disconnect", peer)
  })

  board.connect = connect
  board.destroy = destroy

  return board
}

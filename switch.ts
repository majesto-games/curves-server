import * as Loki from "lokijs"
import TsEventEmitter from "ts-eventemitter"

interface AnnounceData {
  id: IdType
  room?: string
}

interface Board extends TsEventEmitter  {
  rooms: LokiCollection<Room>
  connect: () => Peer
  destroy: () => void
  reset: () => void

  event(name: "data"): TsEventEmitter.Event1<Board, {data: string, peer: Peer}>
  event(name: "announce"): TsEventEmitter.Event1<Board, {peer: Peer, data: AnnounceData}>
  event(name: "leave"): TsEventEmitter.Event1<Board, Peer>
  event(name: "peer:connect"): TsEventEmitter.Event1<Board, Peer>
  event(name: "peer:disconnect"): TsEventEmitter.Event1<Board, Peer>
  event(name: "room:create"): TsEventEmitter.Event1<Board, string>
  event(name: "room:destroy"): TsEventEmitter.Event1<Board, string>
}

type IdType = string | number

interface Peer extends TsEventEmitter  {
  id: IdType
  room: Room | null
  leave: () => boolean
  process: (data: string) => void

  event(name: "data"): TsEventEmitter.Event1<Peer, string>
}

interface Room {
  name: string
  memberCount: number
  members: Peer[]
}

function jsonparse(input: string) {
  try {
    return JSON.parse(input)
  } catch (e) {
    return input
  }
}

export  function createBoard(): Board {
  const board = TsEventEmitter.create() as Board
  const db = new Loki("")
  const rooms = board.rooms = db.addCollection<Room>("rooms", {
    unique: ["name"],
    indices: ["memberCount"],
  })

  function connect() {
    const peer = TsEventEmitter.create() as Peer

    function process(data: string) {
      // emit the data for the board to process
      board.event("data").emit({ data, peer })

      if (data.charAt(0) === "/") {
        const command = data.slice(1, data.indexOf("|", 1)).toLowerCase()

        // split data and parse the parts
        const parts = data.slice(command.length + 2).split("|").map(jsonparse)

        switch (command) {
          case "to": {
            const idPart: IdType = parts[0]
            const target = peer.room && peer.room.members.find((member: any) => member.id === idPart)

            if (target) {
              target.event("data").emit(data)
            } else {
              console.warn(`got a to request for id "${idPart}" but cannot find target`)
            }

            return
          }
          case "leave": {
            board.event("leave").emit(peer)
            break
          }
          case "announce": {
            board.event("announce").emit({peer, data: parts[1]})
            break
          }
          default: {
            console.warn(`dropped "${command}" event from ${parts[0]}`)

          }
        }

        if (peer.room) {
          peer.room.members.filter((p: any) => p !== peer).forEach(member => member.event("data").emit(data))
        }
      }
    }

    // add peer functions
    peer.process = process
    peer.leave = () => board.event("leave").emit(peer)

    // trigger the peer connect
    board.event("peer:connect").emit(peer)

    return peer
  }

  function getRoom(name: string): Room | null {
    return rooms.by("name", name)
  }

  function createRoom(name: string) {
    // create a simple room object
    const room = rooms.insert({
      name,
      memberCount: 0,
      members: [],
    })

    board.event("room:create").emit(name)
    return room
  }

  function destroy() {
    rooms.clear()
  }

  function getOrCreateRoom(name: string) {
    return getRoom(name) || createRoom(name)
  }

  // handle announce messages
  board.event("announce").on(({peer, data}: {peer: Peer, data: AnnounceData }) => {
    const targetRoom: string | undefined = data && data.room
    const room = targetRoom && getOrCreateRoom(targetRoom)

    // a peer can only be in one room at a time
    // trigger a leave command if the peer joins a new room
    if (peer.room && peer.room.name !== targetRoom) {
      board.event("leave").emit(peer)
    }

    // tag the peer
    peer.room = room || null
    peer.id = data.id

    if (room) {
      // add the peer to the room
      room.members = room.members.filter((member: any) => member.id !== peer.id).concat([peer])

      room.memberCount = room.members.length

      // store the update in the db
      rooms.update(room)

      // send the number of members back to the peer
      peer.event("data").emit(`/roominfo|{"memberCount":${room.members.length}}`)
    }
  })

  board.event("leave").on((peer: Peer) => {
    if (peer.room) {
      // remove the peer from the room
      peer.room.members = peer.room.members.filter((p: any) => p !== peer)

      // if we have no more members in the room, then destroy the room
      if (peer.room.members.length === 0) {
        board.event("room:destroy").emit(peer.room.name)
        rooms.remove(peer.room)
      } else {
        // store the update in the db
        rooms.update(peer.room)
      }

      peer.room = null
    }

    board.event("peer:disconnect").emit(peer)
  })

  board.connect = connect
  board.destroy = destroy

  return board
}

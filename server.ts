import * as Koa from "koa"
import * as KoaRouter from "koa-router"
import * as cors from "kcors"
import * as WebSocket from "ws"
import * as http from "http"
import { createBoard } from "./switch"

const app = new Koa()
const port = parseInt(process.env.NODE_PORT || process.env.PORT || process.argv[2], 10) || 3000
const host = process.env.NODE_HOST || process.env.HOST || "0.0.0.0"

const board = createBoard()

const server = http.createServer(app.callback())

const wss = new WebSocket.Server({ server })

let connections: WebSocket[] = [];

wss.on("connection", client => {
  const peer = board.connect()

  connections.push(client)

  client.on("message", peer.process)
  peer.event("data").on((data: any) => {
    if (client.readyState === 1) {
      client.send(data)
    }
  })

  client.on("close", () => {
    peer.leave()

    connections = connections.filter((conn) => conn !== client)
  })
})

board.reset = () => {
  connections.splice(0).forEach(function (conn) {
    conn.close()
  })
}

function sanitizeRoom({ name, memberCount }: any) {
  return {
    name,
    memberCount,
  }
}

const router = new KoaRouter()

router.get("/", async (ctx, next) => {
  ctx.body = board.rooms.chain().simplesort("memberCount", true).data().map(sanitizeRoom)
})

app.use(cors())
app.use(router.routes()).use(router.allowedMethods())

// server.on("request", function (req, res) {
//   if (req.url === "/") {
//     res.writeHead(302, {
//       Location: "https://github.com/rtc-io/rtc-switchboard",
//     })
//     res.end("switchboard available from: https://github.com/rtc-io/rtc-switchboard")
//   }
//   if (req.url === "/rooms") {
//     res.end(JSON.stringify(board.rooms.chain().simplesort("memberCount", true).data().map(sanitizeRoom)))
//   }
// })

// start the server
server.listen(port, host, (err: Error) => {
  if (err) {
    console.log("Couldn't start server: ", err)
    return
  }

  console.log(`server running at http://${host}:${port}/`)
})

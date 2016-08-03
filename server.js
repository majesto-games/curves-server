const server = require("http").createServer()
const switchboard = require("./")
const port = parseInt(process.env.NODE_PORT || process.env.PORT || process.argv[2], 10) || 3000
const host = process.env.NODE_HOST || process.env.HOST || "0.0.0.0"


const board = switchboard(server)

function logRooms() {
  console.log(board.rooms.chain().simplesort("memberCount", true).data())
}

function sanitizeRoom({ name, memberCount }) {
  return {
    name,
    memberCount,
  }
}

setInterval(logRooms, 4000)

server.on("request", function (req, res) {
  if (req.url === "/") {
    res.writeHead(302, {
      Location: "https://github.com/rtc-io/rtc-switchboard",
    })
    res.end("switchboard available from: https://github.com/rtc-io/rtc-switchboard")
  }
  if (req.url === "/rooms") {
    res.end(JSON.stringify(board.rooms.chain().simplesort("memberCount", true).data().map(sanitizeRoom)))
  }
})

// start the server
server.listen(port, host, function (err) {
  if (err) {
    console.log("Couldn't start server: ", err)
    return
  }

  console.log(`server running at http://${host}:${port}/`)
})

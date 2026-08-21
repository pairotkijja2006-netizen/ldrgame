const http = require("http");
const path = require("path");
const os = require("os");
const express = require("express");
const { Server } = require("socket.io");
const { Room } = require("./room");

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.use(
  express.static(path.join(__dirname, "..", "public"), {
    etag: false,
    lastModified: false,
    setHeaders(res, filePath) {
      if (/\.(js|css|html)$/.test(filePath)) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
    },
  })
);

const sockets = new Map();

function broadcast() {
  for (const [socket, playerId] of sockets.entries()) {
    if (!socket.connected) continue;
    socket.emit("state", room.viewFor(playerId));
  }
  room.consumeFx();
}

const room = new Room(broadcast);

io.on("connection", (socket) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  const result = room.join(socket.id, token);

  if (result.full) {
    socket.emit("serverFull");
    return;
  }

  sockets.set(socket, result.playerId);
  socket.emit("joined", { playerId: result.playerId, token: result.token, reconnected: result.reconnected });
  broadcast();

  socket.on("selectCharacter", (character) => {
    const r = room.selectCharacter(result.playerId, character);
    if (r && r.error) socket.emit("notice", r.error);
    broadcast();
  });

  socket.on("advance", () => {
    room.advanceDialogue(result.playerId);
    broadcast();
  });

  socket.on("input", (data) => {
    room.setInput(result.playerId, data || {});
  });

  socket.on("puzzle", (payload) => {
    room.puzzleInput(result.playerId, payload || {});
    broadcast();
  });

  socket.on("interact", () => {
    room.interact(result.playerId);
    broadcast();
  });

  socket.on("restartTask", () => {
    room.restartTask();
    broadcast();
  });

  socket.on("restartGame", () => {
    room.restartGame();
    broadcast();
  });

  socket.on("choosePath", (payload) => {
    room.choosePath(result.playerId, payload && payload.choice);
    broadcast();
  });

  socket.on("playAgain", () => {
    room.playAgain();
    broadcast();
  });

  socket.on("skipToEnd", () => {
    room.skipGame();
    broadcast();
  });
  socket.on("skipGame", () => {
    room.skipGame();
    broadcast();
  });
  socket.on("pause", () => {
    room.setPaused(true);
    broadcast();
  });
  socket.on("resume", () => {
    room.setPaused(false);
    broadcast();
  });

  socket.on("disconnect", () => {
    sockets.delete(socket);
    room.disconnect(socket.id);
    broadcast();
  });
});

function lanAddress() {
  try {
    const ifaces = os.networkInterfaces();
    for (const list of Object.values(ifaces)) {
      for (const i of list || []) {
        if (i.family === "IPv4" && !i.internal) return i.address;
      }
    }
  } catch {
    // Some sandboxed environments deny interface lookups; the LAN hint is optional.
  }
  return null;
}

server.listen(PORT, "0.0.0.0", () => {
  const lan = lanAddress();
  console.log(`LDR listening on http://localhost:${PORT}`);
  if (lan) console.log(`LAN: http://${lan}:${PORT}`);
  console.log("Open two browser windows to play.");
});

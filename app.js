const express = require("express");
const path = require("path");
const app = express();

const PORT = 3000;

// Setting up Views and Directories
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use("/static", express.static(path.join(__dirname, "public")));

// Helper functions

/**
 * Helper function that adds socket to a room
 * @param {socket} socket
 * @param {string} name
 * @param {string} rawID
 * @return {string}
 */
function joinRoom(socket, name, rawID) {
  let roomID = String(rawID);
  socket.room = roomID;
  socket.join(roomID);
  console.log(`${name} joined ${roomID}`);

  // Send join confirmation
  socket.emit("joinedRoom", name, roomID);

  // Update people in room
  if (games[roomID]) {
    io.sockets.in(roomID).emit("updatePlayers", games[roomID].players);
  } else {
    games[rawID] = { status: "lobby", players: [socket.username] };
    io.sockets.in(roomID).emit("updatePlayers", games[roomID].players);
  }

  return roomID;
}

/**
 * Generates random 6 character string for UID
 * credit: https://stackoverflow.com/questions/6248666/how-to-generate-short-uid-like-ax4j9z-in-js
 */
function generateUID() {
  var firstPart = (Math.random() * 46656) | 0;
  var secondPart = (Math.random() * 46656) | 0;
  firstPart = ("000" + firstPart.toString(36)).slice(-3);
  secondPart = ("000" + secondPart.toString(36)).slice(-3);
  return firstPart + secondPart;
}

// Open games
const games = {};

// Socket Handlers
let http = require("http").Server(app);
const io = require("socket.io")(http);

io.on("connection", socket => {
  console.log("a user connected");

  // Default username
  socket.username = "anonymous";

  // Rejoin Room on Refresh
  socket.on("rejoinSession", (name, rawID) => {
    socket.username = name;

    joinRoom(socket, name, rawID);
  });

  // Create a New Room
  socket.on("createRoom", name => {
    // Set username for room
    socket.username = name;

    // Create and join room
    let rawID = generateUID();
    games[rawID] = { status: "lobby", players: [socket.username] };
    joinRoom(socket, name, rawID);
  });

  // Join an Existing Room
  socket.on("joinRoom", (name, rawID) => {
    // Set username for room
    socket.username = name;

    // Add as player to room sesh
    games[rawID].players.push(socket.username);

    // Join room if it exists
    let roomID = joinRoom(socket, name, rawID);
  });

  // Leave Room
  socket.on("leaveRoom", (name, roomID) => {
    if (socket.room) {
      socket.leave(socket.room);
    }
    if (name in games[rawID].players) {
      games[rawID].players.splice(games[rawID].players.indexOf(name));
    }
    socket.username = "anonymous";
    socket.room = undefined;
  });
});

// Routes
app.get("/", function(req, res) {
  res.render("index");
});

app.get("/create", function(req, res) {
  res.render("create");
});

app.get("/lobby", function(req, res) {
  res.render("lobby");
});

app.get("/join", function(req, res) {
  res.render("join");
});

// Run App
http.listen(PORT);
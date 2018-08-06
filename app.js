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
  io.sockets.in(roomID).emit("updatePlayers", games[roomID].players);

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

// DEBUG: purposes only
let openSockets = 0;

// Socket Handlers
let http = require("http").Server(app);
const io = require("socket.io")(http);

io.on("connection", socket => {
  // Default username
  socket.username = "anonymous";

  // Rejoin Room on Refresh
  socket.on("rejoinSession", (name, rawID) => {
    socket.username = name;

    // Join room if it still exists
    if (rawID in games) {
      joinRoom(socket, name, rawID);
    } else {
      socket.emit("joinError", "");
    }
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

    // Join room if it exists
    if (rawID in games) {
      // Add as a player to room
      games[rawID].players.push(socket.username);
      joinRoom(socket, name, rawID);
    } else {
      // Otherwise render error
      socket.emit("joinError", `Game ${rawID} does not exist`);
    }
  });

  // Leave Room
  socket.on("leaveRoom", (name, rawID) => {
    if (rawID in games) {
      // Remove self from players list
      if (games[rawID].players.indexOf(name) > -1) {
        games[rawID].players.splice(games[rawID].players.indexOf(name));
      }

      // Tell everyone in the room you are leaving
      io.sockets.in(rawID).emit("updatePlayers", games[rawID].players);

      // If you were the last player, delete the game
      if (games[rawID].players.length < 1) {
        delete games[rawID];
      }
    }

    // Clear socket affiliation
    socket.username = "anonymous";
    socket.room = undefined;
    if (socket.room) {
      socket.leave(socket.room);
    }
  });

  // DEBUG: purposes
  openSockets++;
  console.log(`${openSockets} player(s) online`);
  socket.on("disconnect", function() {
    openSockets--;
    console.log(`${openSockets} player(s) online`);
  });
});

// Routes
app.get("/", function(req, res) {
  res.render("index", { routeGame: false });
});

app.get("/:gamecode", function(req, res) {
  // Try game code
  let gamecode = req.params.gamecode;
  if (gamecode.length === 6) {
    if (gamecode in games) {
      res.render("index", { routeGame: gamecode });
    }
  }

  res.redirect("/");
});

// app.get("/create", function(req, res) {
//   res.render("create");
// });
//
// app.get("/lobby", function(req, res) {
//   res.render("lobby");
// });
//
// app.get("/join", function(req, res) {
//   res.render("join");
// });

// Run App
http.listen(PORT);

const express = require("express");
const path = require("path");
const app = express();
const GAME = require("./game.js");

const PORT = 3000;

// Setting up Views and Directories
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use("/static", express.static(path.join(__dirname, "public")));

// Socket Helpers

/**
 * Helper function that adds socket to a room
 * @param {socket} socket
 * @param {string} name
 * @param {string} rawID
 * @return {string}
 */
function enterRoom(socket, name, seshID, rawID) {
  // Add as a player to room
  let roomID = String(rawID);
  socket.join(roomID);
  socket.room = roomID;
  socket.sesh = seshID;
  socket.username = name;

  // Send join confirmation
  socket.emit("joinedRoom", name, seshID, roomID);

  // Update people in room
  io.sockets.in(roomID).emit("updatePlayers", openGames[roomID].playerList);

  return roomID;
}

// Open games
const openGames = {
  notFoo: new GAME.State()
};

// DEBUG: purposes only
let openSockets = 0;

// Socket Handlers
let http = require("http").Server(app);
const io = require("socket.io")(http);
io.on("connection", socket => {
  // Default username
  socket.username = "anonymous";

  // Rejoin Room on Refresh
  socket.on("rejoinSession", (name, seshID, rawID) => {
    // Join room if it still exists
    if (rawID in openGames) {
      enterRoom(socket, name, seshID, rawID);
    } else {
      socket.emit("joinError", `Room ${rawID} no longer exists.`);
    }
  });

  // Create a New Room
  socket.on("createRoom", (name, seshID) => {
    // Set username for room
    socket.username = name;

    // Create and join room
    let rawID = GAME.generateUID();
    openGames[rawID] = new GAME.State();
    openGames[rawID].add(seshID, name); // Add player
    enterRoom(socket, name, seshID, rawID);
  });

  // Join an Existing Room
  socket.on("joinRoom", (name, seshID, rawID) => {
    // Join room if it exists
    if (rawID in openGames) {
      openGames[rawID].add(seshID, name);
      enterRoom(socket, name, seshID, rawID);
      console.log(`${name} joined ${rawID}`);
    } else {
      // Otherwise render error
      socket.emit("joinError", `Game ${rawID} does not exist`);
    }
  });

  // Leave Room
  socket.on("leaveRoom", (seshID, rawID) => {
    if (rawID in openGames) {
      let theGame = openGames[rawID];
      console.log(seshID);
      // Remove self from players list
      if (theGame.has(seshID)) {
        theGame.kick(seshID);
      }

      // Tell everyone in the room you are leaving
      io.sockets.in(rawID).emit("updatePlayers", theGame.playerList);

      // If you were the last player, delete the game
      if (theGame.playerCount < 1) {
        delete openGames[rawID];
      }
    }

    // Clear socket affiliation
    socket.username = "anonymous";
    socket.room = undefined;
    socket.sesh = undefined;
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
    if (gamecode in openGames) {
      res.render("index", { routeGame: gamecode });
    }
  }

  res.redirect("/");
});

// Run App
http.listen(PORT);

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

function saveSocketAffiliation(socket, name, seshID, rawID) {
  socket.room = rawID;
  socket.sesh = seshID;
  socket.username = name;
}

/**
 * Helper function to create new player
 * @param {socket} socket
 * @param {string} name
 * @param {string} rawID
 * @return {string}
 */
function newPlayer(socket, name, seshID, rawID) {
  // Add as player of game
  openGames[rawID].add(seshID, name);
  openGames[rawID].players[seshID].socketid = socket.id;

  saveSocketAffiliation(socket, name, seshID, rawID);
}

/**
 * Helper function that adds socket to a room
 * @param {socket} socket
 * @param {string} name
 * @param {string} rawID
 * @return {string}
 */
function enterRoom(socket, name, seshID, rawID) {
  // Add as player to socket room
  let roomID = String(rawID);
  socket.join(roomID);

  let theGame = openGames[roomID];

  // Send join confirmation
  socket.emit("joinedRoom", name, seshID, roomID, theGame.state);

  // Update people in room
  if (theGame.state === 0) {
    io.sockets.in(roomID).emit("updateLobby", theGame.playerList);
  }

  return roomID;
}

/**
 * Tells player their character info
 * @param {Player object} player
 */
function tellPlayerIdentity(player) {
  // Get player enchantments on purity/sight/force
  io.to(player.socketid).emit(
    "yourInfo",
    player.role,
    player.color,
    player.enchantments
  );

  // If player is darkened, don't send anything else
  if (player.sight < 0) {
    return;
  }

  // itemType: 2 if casts on multiple, 1 if casts on any one, 0 if casts on self, -1 if tome
  let itemType = player.item.spellType;

  // If tome, pass the config
  let read = undefined;
  if (itemType === -1) {
    read = Array.from(player.item.config);
  }

  // Check if item is still in cooldown
  let enabled = false;
  if (player.item.usable) {
    enabled = true;
  }
  io.to(player.socketid).emit(
    "yourItem",
    player.item.name,
    player.item.about,
    itemType,
    enabled,
    read
  );
}

function updateGameAPlayer(socketid, theGame, seshID, correct) {
  // Send solutions to true sight
  if (theGame.players[seshID].sight > 0 && correct !== false) {
    console.log(correct);
    io.to(socketid).emit("truthSeen", correct);
  }

  // Don't send if darkened
  if (theGame.players[seshID].sight >= 0) {
    // Send number correct
    if (correct !== false) {
      io.to(socketid).emit(
        "updateGame",
        theGame.results,
        correct.length,
        theGame.circle
      );
    } else {
      io.to(socketid).emit(
        "updateGame",
        theGame.results,
        false,
        theGame.circle
      );
    }
  }
}

function updateGameAllPlayers(theGame, correct) {
  for (let p of theGame.playerIDs) {
    let player = theGame.players[p];

    updateGameAPlayer(player.socketid, theGame, p, correct);
  }
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

      // Update player's socket id
      let theGame = openGames[rawID];
      theGame.players[seshID].socketid = socket.id;

      if (theGame.state === 1) {
        tellPlayerIdentity(theGame.players[seshID]);
        saveSocketAffiliation(socket, name, seshID, rawID);
        updateGameAPlayer(socket.id, theGame, seshID, false);
        socket.emit("updateCasters", theGame.playerColorList);
      }
    } else {
      socket.emit("joinError", `Room ${rawID} no longer exists.`);
    }
  });

  // Create a New Room
  socket.on("createRoom", (name, seshID) => {
    // Set username for room
    socket.username = name;

    // Create room
    let rawID = GAME.generateUID();
    openGames[rawID] = new GAME.State();

    newPlayer(socket, name, seshID, rawID);
    enterRoom(socket, name, seshID, rawID);
    console.log(`${name} created ${rawID}`);
  });

  // Join an Existing Room
  socket.on("joinRoom", (name, seshID, rawID) => {
    // Join room if it exists
    if (rawID in openGames) {
      newPlayer(socket, name, seshID, rawID);
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
      // Remove self from players list
      if (theGame.has(seshID)) {
        theGame.kick(seshID);
      }

      // Tell everyone in the room you are leaving
      if (theGame.state === 0) {
        io.sockets.in(rawID).emit("updateLobby", theGame.playerList);
      } else if (theGame.state === 1) {
        io.sockets.in(rawID).emit("updateCasters", theGame.playerColorList);
      }

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

  // Start Game
  socket.on("startGame", () => {
    if (socket.room in openGames) {
      let theGame = openGames[socket.room];
      if (theGame.state === 0) {
        theGame.start();
        theGame.gameTime = new GAME.Timer(function() {
          // Tell everyone the time
          io.sockets.in(socket.room).emit("gameTime", theGame.time);

          // Update everyone on their info
          for (let p of theGame.playerIDs) {
            tellPlayerIdentity(theGame.players[p]);
          }

          if (theGame.time === "00:00") {
            theGame.gameTime.stop();
          }
        }, 7 * 60);

        // Tell everyone the game has started
        io.sockets
          .in(socket.room)
          .emit("gameStart", openGames[socket.room].playerColorList);

        // Tell each socket member who they are
        for (let p of theGame.playerIDs) {
          let player = theGame.players[p];

          tellPlayerIdentity(player);
        }
      }
    }
  });

  // Cast color
  socket.on("castColor", (seshID, spot) => {
    if (socket.room in openGames) {
      let theGame = openGames[socket.room];
      if (theGame.state === 1) {
        let correct = theGame.cast(seshID, spot);

        // Check if a full cast
        if (correct === undefined) {
          // Tell everyone new game status
          updateGameAllPlayers(theGame, false);
        } else {
          // Tell everyone new game status
          updateGameAllPlayers(theGame, correct);

          if (!theGame.results) {
            theGame.circle = [undefined, undefined, undefined];
          }
        }
      }
    }
  });

  // Player uses an item
  socket.on("useItem", (seshID, selected) => {
    if (socket.room in openGames) {
      let theGame = openGames[socket.room];
      if (theGame.state === 1) {
        theGame.useItem(seshID, selected);

        // Update everyone on their identities
        for (let p of theGame.playerIDs) {
          let player = theGame.players[p];

          tellPlayerIdentity(player);
        }

        console.log("An item was successfully used");
      }
    }
  });

  // End game
  // TODO: make this better so you don't leave the room
  socket.on("endGame", () => {
    if (socket.room in openGames) {
      let theGame = openGames[socket.room];

      // Tell everyone the game has ended
      io.sockets.in(socket.room).emit("gameEnded");

      // Delete the game
      delete theGame;

      // Clear socket affiliation
      socket.username = "anonymous";
      socket.room = undefined;
      socket.sesh = undefined;
      if (socket.room) {
        socket.leave(socket.room);
      }
    }
  });

  // DEBUG: purposes only
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

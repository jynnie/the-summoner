const URL = "http://" + document.domain + ":" + location.port;
const storage = window.localStorage;
let globalSeshID = null;
let globalRoomID = null;
let globalUsername = null;

/**
 * Function that generates a unique "session" id based on time
 * Credit: https://gist.github.com/gordonbrander/2230317
 * @return {string}
 */
function generateSessionUUID() {
  let uuid = (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substr(2, 5)
  ).toUpperCase();
  return uuid;
}

// Make connection
let socket = io.connect(URL);

socket.on("connect", function() {
  console.log("Connected to server");

  // Check localstorage for previous connection
  let sessionID = storage.getItem("sessionID");
  let userSession = storage.getItem("userSession");
  if (sessionID !== "null" && sessionID !== null) {
    seshID = sessionID;

    let userInfo = JSON.parse(userSession);
    globalUsername = userInfo.username;
    globalRoomID = userInfo.room;

    socket.emit("rejoinSession", globalUsername, globalRoomID);
  } else {
    // Redirect to home if not in a game
    if (
      window.location.pathname === "/lobby" ||
      window.location.pathname === "/game"
    ) {
      window.location = URL + "/";
    }
  }
});

// Confirms room was joined
socket.on("joinedRoom", (name, roomID) => {
  console.log(`Confirmed ${name} joined ${roomID}`);

  // Save to localStorage
  storage.setItem(
    "userSession",
    JSON.stringify({ username: name, room: roomID })
  );
  storage.setItem("sessionID", globalSeshID);
  globalUsername = name;
  globalRoomID = roomID;

  // If in lobby, update game code
  if (window.location.pathname === "/lobby") {
    document.getElementById("gameCode").innerHTML = roomID;
  }
});

socket.on("updatePlayers", function(players) {
  // If in lobby, update players
  if (window.location.pathname === "/lobby") {
    let playerList = document.getElementById("playersInLobby");
    // Clear list
    while (playerList.lastChild) {
      playerList.removeChild(playerList.firstChild);
    }

    for (let player of players) {
      let newPlayer = document.createElement("li");
      newPlayer.innerHTML = String(player);
      playerList.appendChild(newPlayer);
    }
  }
});

function createRoom() {
  let name = document.getElementById("player_name").value;
  seshID = generateSessionUUID();
  storage.setItem("sessionID");
  socket.emit("createRoom", name);

  // Send to lobby
  window.location = URL + "/lobby";
}

function joinRoom() {
  if (globalSeshID) {
    socket.emit("leaveRoom");
  }

  globalSeshID = generateSessionUUID();

  socket.emit(
    "joinRoom",
    document.getElementById("player_name").value,
    document.getElementById("game_id").value
  );

  // Send to lobby
  window.location = URL + "/lobby";
}

function leaveRoom() {
  socket.emit("leaveRoom", globalUsername, globalRoomID);

  // Clear cache
  storage.setItem("userSession", null);
  storage.setItem("sessionID", null);
  globalSeshID = null;
  globalSeshID = null;
  globalRoomID = null;

  // Send to home
  window.location = URL + "/";
}

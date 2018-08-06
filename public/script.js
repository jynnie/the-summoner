const URL = "http://" + document.domain + ":" + location.port;
const storage = window.localStorage;
let globalRoomID = null;
let globalUsername = null;

// Make connection
let socket = io.connect(URL);

// -- Socket Listeners --
socket.on("connect", function() {
  console.log("Connected to server");

  // Check localstorage for previous connection
  let userSession = storage.getItem("userSession");
  if (userSession !== "null" && userSession !== null) {
    let userInfo = JSON.parse(userSession);
    globalUsername = userInfo.username;
    globalRoomID = userInfo.room;

    socket.emit("rejoinSession", globalUsername, globalRoomID);
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
  globalUsername = name;
  globalRoomID = roomID;

  // Render lobby
  changeDOMText("gameCode", roomID);
  changeDOMText("joinError", "");
  renderLobby();
});

socket.on("updatePlayers", function(players) {
  // If in lobby, update players
  if (globalRoomID) {
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

socket.on("joinError", function(err) {
  console.log(err);
  changeDOMText("joinError", err);
  clearCache();
});

// -- Socket Emits --
function createRoom() {
  let name = document.getElementById("create_player_name").value;
  socket.emit("createRoom", name);

  // Send to lobby
  renderLobby();
}

function joinRoom() {
  if (globalRoomID) {
    socket.emit("leaveRoom");
  }

  let joinUsername = document.getElementById("join_player_name").value;
  let joinRoom = document.getElementById("join_game_id").value;

  // Form verification
  if (joinRoom.length !== 6) {
    changeDOMText("joinError", "Please enter a six character game code");
    return;
  }

  if (joinUsername.length === 0) {
    changeDOMText("joinError", "Please enter a player name");
    return;
  }

  socket.emit("joinRoom", joinUsername, joinRoom);
}

function leaveRoom() {
  socket.emit("leaveRoom", globalUsername, globalRoomID);
  clearCache();

  // Reset lobby
  changeDOMText("gameCode", "&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;");

  // Send to home
  renderLanding();
}

// -- Base View Render Functions --
const INDEXPAGES = ["landing", "create", "join", "lobby"];
const DYNAMICTEXT = ["joinError"];

/**
 * Renders a page on the index.pug
 * @param {string} page
 */
function renderIndexPage(page) {
  hideAllPages(INDEXPAGES);
  clearDynamicText(DYNAMICTEXT);
  clearInputs();

  // Clear lobby players
  let playerList = document.getElementById("playersInLobby");
  while (playerList.lastChild) {
    playerList.removeChild(playerList.firstChild);
  }

  displayPage(page);
}

/**
 * @param {Array} domIDs
 */
function clearDynamicText(domIDs) {
  for (let i of domIDs) {
    changeDOMText(i, "");
  }
}

function clearInputs() {
  let inputs = document.getElementsByTagName("input");

  for (let i of inputs) {
    i.value = "";
  }
}

/**
 * @param {string} page
 */
function displayPage(page) {
  document.getElementById(page + "Page").style.display = "block";
}

/**
 * @param {string} page
 */
function hidePage(page) {
  document.getElementById(page + "Page").style.display = "none";
}

/**
 * @param {Array} pages
 */
function hideAllPages(pages) {
  for (let p of pages) {
    hidePage(p);
  }
}

/**
 * @param {string} elementId
 * @param {string} text
 */
function changeDOMText(elementID, text) {
  document.getElementById(elementID).innerHTML = text;
}

// -- Alias View Render Functions --
function renderCreate() {
  renderIndexPage("create");
}

function renderLanding() {
  renderIndexPage("landing");
}

function renderJoin() {
  renderIndexPage("join");
}

function renderLobby() {
  renderIndexPage("lobby");
}

// -- Other Helper Functions --

function clearCache() {
  storage.setItem("userSession", null);
  globalUsername = null;
  globalRoomID = null;
}

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

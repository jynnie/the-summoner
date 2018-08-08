const URL = "http://" + document.domain + ":" + location.port;
const storage = window.localStorage;
let globalSeshID = null;
let globalRoomID = null;
let globalUsername = null;

// Make connection
let socket = io.connect(URL);

// -- Socket Listeners --
socket.on("connect", () => {
  console.log("Connected to server");

  // Check localstorage for previous connection
  let userSession = storage.getItem("userSession");
  if (userSession !== "null" && userSession !== null) {
    let userInfo = JSON.parse(userSession);
    globalUsername = userInfo.username;
    globalRoomID = userInfo.room;
    globalSeshID = userInfo.sesh;

    socket.emit("rejoinSession", globalUsername, globalSeshID, globalRoomID);
  }
});

// Confirms room was joined
socket.on("joinedRoom", (name, seshID, roomID, state) => {
  console.log(`Confirmed ${name} joined ${roomID}`);

  // Save to localStorage
  storage.setItem(
    "userSession",
    JSON.stringify({ username: name, room: roomID, sesh: seshID })
  );
  globalUsername = name;
  globalRoomID = roomID;
  globalSeshID = seshID;

  // Change URL
  if (window.location.pathname === "/") {
    window.history.pushState(roomID, "The Summoner", `/${roomID}`);
  }

  if (state === 0) {
    // Render lobby
    changeDOMText("gameCode", roomID);
    changeDOMText("joinError", "");
    renderLobby();
  }
  if (state === 1) {
    // Render game
    renderGame();
  }
});

socket.on("updateLobby", players => {
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

socket.on("joinError", err => {
  console.log(err);
  changeDOMText("joinError", err);
  clearCache();
  window.location.pathname = "/";
});

socket.on("gameStart", players => {
  updateInGameCasters(players);
  renderGame();
});

socket.on("updateCasters", players => updateInGameCasters(players));

socket.on("yourInfo", (role, color, item, about) => {
  changeDOMText("playerRole", role);
  changeDOMText("playerColor", color);
  changeDOMText("playerItem", item);
  changeDOMText("playerItemAbout", about);
});

// -- Socket Emits --
function createRoom() {
  let name = document.getElementById("create_player_name").value;
  let sesh = generateSessionUUID();

  // Form verification
  if (name.length === 0) {
    changeDOMText("createError", "Please enter a player name");
    return;
  }

  socket.emit("createRoom", name, sesh);

  // Send to lobby
  renderLobby();
}

function joinRoom() {
  if (globalRoomID) {
    socket.emit("leaveRoom");
  }

  let joinUsername = document.getElementById("join_player_name").value;
  let joinRoom = document.getElementById("join_game_id").value;
  let joinSesh = generateSessionUUID();

  // Form verification
  if (joinRoom.length !== 6) {
    changeDOMText("joinError", "Please enter a six character game code");
    return;
  }

  if (joinUsername.length === 0) {
    changeDOMText("joinError", "Please enter a player name");
    return;
  }

  socket.emit("joinRoom", joinUsername, joinSesh, joinRoom);
}

function leaveRoom() {
  socket.emit("leaveRoom", globalSeshID, globalRoomID);
  clearCache();

  // Reset lobby
  changeDOMText("gameCode", "&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;");

  // Send to home
  renderLanding();

  // Change URL
  if (window.location.pathname !== "/") {
    window.location.pathname = "/";
  }
}

function startGame() {
  socket.emit("startGame");
}

// -- Helper Functions --

/**
 * @param {number} duration in seconds
 * Modified version of the one in game.js
 * Credit: https://stackoverflow.com/questions/20618355/the-simplest-possible-javascript-countdown-timer
 */
const startTimer = (duration, display) => {
  let timer = duration,
    minutes,
    seconds;
  setInterval(function() {
    minutes = parseInt(timer / 60, 10);
    seconds = parseInt(timer % 60, 10);

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    display.innerHTML = `${minutes}:${seconds}`;

    if (--timer < 0) {
      timer = 0;
      return;
    }
  }, 1000);
};

// Clears local storage
function clearCache() {
  storage.setItem("userSession", null);
  globalUsername = null;
  globalRoomID = null;
  globalSeshID = null;
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

// -- Base View Render Functions --
const INDEXPAGES = ["landing", "create", "join", "lobby", "game"];
const DYNAMICTEXT = ["joinError", "playerRole"];

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

// Clears all inputs
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
  document.getElementById(page + "_").style.display = "block";
}

/**
 * @param {string} page
 */
function hidePage(page) {
  document.getElementById(page + "_").style.display = "none";
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

// Updates list of casters in game page
function updateInGameCasters(players) {
  let playerList = document.getElementById("playersInGame");
  // Clear list
  while (playerList.lastChild) {
    playerList.removeChild(playerList.firstChild);
  }

  for (let player of players) {
    let newPlayer = document.createElement("li");
    newPlayer.innerHTML = `${player[1]} ${player[0]}`;
    newPlayer.classList.add(player[1]);
    playerList.appendChild(newPlayer);
  }
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

function renderGame() {
  renderIndexPage("game");
  let gameTimer = document.getElementById("gameTimer");
  startTimer(7 * 60, gameTimer);
}

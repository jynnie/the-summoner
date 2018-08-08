const URL = "http://" + document.domain + ":" + location.port;
const storage = window.localStorage;
let globalSeshID = null;
let globalRoomID = null;
let globalUsername = null;

let selectable = false;
let selectNum = undefined;
let selected = new Set();

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

socket.on("yourInfo", (role, color) => {
  changeDOMText("playerRole", role);
  changeDOMText("playerColor", color);
});

socket.on("yourItem", (name, about, spell, read) => {
  changeDOMText("playerItem", name);
  changeDOMText("playerItemAbout", about);

  if (spell === -1) {
    // Is a tome, show reading
    let spots = ["rock", "paper", "scissors"];
    for (let i of [0, 1, 2]) {
      document.getElementById(spots[i]).className = `spot ${read[i]}`;
    }
    document.getElementById("tomeRead").classList.remove("hide");
    document.getElementById("useItem").classList.add("hide");
    return;
  } else {
    // Is a spell, show cast button
    document.getElementById("tomeRead").classList.add("hide");
    document.getElementById("useItem").classList.remove("hide");
  }

  if (spell > 0) {
    // Make casters selectable
    selectable = true;
    selectNum = spell;

    let playerList = Array.from(
      document.getElementById("playersInGame").childNodes
    );
    for (let player of playerList) {
      player.classList.add("selectable");
      player.onclick = function() {
        select(player.id);
      };
    }
  }
});

socket.on("updateGame", (results, num, circle) => {
  // Set circle colors
  let spots = ["veni", "vidi", "vici"];
  for (let i of [1, 2, 3]) {
    if (circle[i] === undefined) {
      document.getElementById(spots[i - 1]).className = `spot`;
    } else {
      document.getElementById(spots[i - 1]).className = `spot ${circle[i]}`;
    }
  }

  // Display cast number
  console.log(num);
  if (num !== false) {
    changeDOMText("castResult", num);
    document.getElementById("castResult").classList.remove("hide");
    document.getElementById("gameTimer").classList.add("hide");
  }

  if (results) {
    setTimeout(() => {
      changeDOMText("castResult", results);
    }, 1000);
    return;
  } else if (num !== false) {
    setTimeout(() => {
      clearCircle();
      changeDOMText("castResult", "");
      document.getElementById("castResult").classList.add("hide");
      document.getElementById("gameTimer").classList.remove("hide");
    }, 2000);
  }
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

function castColor(spot) {
  socket.emit("castColor", globalSeshID, spot);
  console.log(`${globalUsername} cast on ${spot}`);
}

// -- Helper Functions --

/**
 * Allows for selection of casters for items
 * @param {string} uuid
 */
function select(uuid) {
  console.log(uuid);
  if (selectable) {
    let element = document.getElementById(uuid);
    console.log(element);

    // If selected, deselect
    if (selected.has(uuid)) {
      element.classList.remove("selected");
      selected.delete(uuid);
    }
    // If unselected and within size constraints, select
    else if (selected.size < selectNum) {
      element.classList.add("selected");
      selected.add(uuid);
    }
  }
}

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

  // Clear circle
  document.getElementById("castResult").classList.add("hide");
  document.getElementById("gameTimer").classList.remove("hide");
  clearCircle();

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

// Clear the casting circles
function clearCircle() {
  let spots = ["veni", "vidi", "vici"];
  for (let i of [1, 2, 3]) {
    document.getElementById(spots[i - 1]).className = `spot`;
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
    newPlayer.id = player[2];
    if (selectable) {
      newPlayer.classList.add("selectable");
      newPlayer.onclick = function() {
        select(newPlayer.id);
      };
    }
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

// Utility functions

/**
 * Generates random 6 character string for UID
 * Used for game codes
 * credit: https://stackoverflow.com/questions/6248666/how-to-generate-short-uid-like-ax4j9z-in-js
 */
const generateUID = () => {
  var firstPart = (Math.random() * 46656) | 0;
  var secondPart = (Math.random() * 46656) | 0;
  firstPart = ("000" + firstPart.toString(36)).slice(-3);
  secondPart = ("000" + secondPart.toString(36)).slice(-3);
  return firstPart + secondPart;
};

/**
 * Function that generates a unique player id based on time
 * Credit: https://gist.github.com/gordonbrander/2230317
 * @return {string}
 */
const generatePlayerUUID = () => {
  let uuid = (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substr(2, 5)
  ).toUpperCase();
  return uuid;
};

/**
 * @param {Array}
 * @returns item in array
 */
const randFrom = array => {
  let rand = Array.from(array)[Math.floor(Math.random() * array.size)];
  return rand;
};

/**
 * @param {number} duration in seconds
 * NOT the same as in script.js
 */
const startTimer = duration => {
  let timer = duration;
  setInterval(function() {
    minutes = parseInt(timer / 60, 10);
    seconds = parseInt(timer % 60, 10);

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;
  }, 1000);
};

/**
 * @param {Set} colorPool: of all colors in play
 * @param {Set} vTome: vanquishment tome
 * @param {Set} eTome: tome config that already exists
 * @returns {Set} of new tome
 */
const makeTome = (colorPool, vTome, eTome) => {
  let newTome = new Set(vTome);
  // Choosing 2/3 is the same as picking 1/3
  let notColor = randFrom(vTome);
  newTome.delete(notColor);

  // Make possible color replacements
  let colorOpts = new Set(colorPool);
  vTome.forEach(function(c) {
    colorOpts.delete(c);
  });
  // If shares two colors with eTome, remove eTome's last color
  if (eTome.size === 3) {
    let intersection = new Set([...newTome].filter(x => eTome.has(x)));
    if (intersection.size === 2) {
      eTome.forEach(function(c) {
        colorOpts.delete(c);
      });
    }
  }

  // Pick a random color from remaining options
  let newColor = randFrom(colorOpts);
  newTome.add(newColor);

  return newTome;
};

/****************
 * Game classes *
 ***************/
const MANACOLORS = ["red", "orange", "green", "blue", "pink", "purple"];

// Player class
class Caster {
  constructor(
    uuid,
    name,
    color = undefined,
    item = undefined,
    role = undefined
  ) {
    this.uuid = uuid;
    this.name = name;
    this.socketid = null;
    this.color = color;
    this.item = item;
    this.role = role;
    this.sight = 0;
  }
  get id() {
    return this.uuid;
  }
  assignColor(color) {
    this.color = color;
  }
  give(item) {
    this.item = item;
  }
  take() {
    let item = this.item;
    this.item = undefined;
    return item;
  }
}

/****************
 * Item classes *
 ***************/
class aTome {
  constructor(config, type) {
    this.name = "a Tome";
    this.role = type;
    this.config = config; // color Set;
  }
  get about() {
    return "A tome details a mana color combo that either summons the demon or blows everyone up. But two of the three colors are correct for vanquishing the circle.";
  }
  get read() {
    return this.config;
  }
}

class Item {
  constructor() {
    this.name = "";
  }
}

class Spell extends Item {
  constructor() {
    super();
    this.active = false;
    this.cooldown = null;
    this.cooldownTimer = null;
  }
}

class holyPurity extends Item {
  constructor() {
    super();
    this.name = "Holy Purity";
    this.used = false;
    this.enchanted = null;
  }
  get about() {
    return "Holy purity can only be cast once, but at any time (even during a darkening). The user cannot be darkened and if cast on the anarchist, they become a guardian.";
  }
  cast(player) {}
}

class trueSight extends Spell {
  constructor() {
    super();
    this.name = "True Sight";
    this.activeTimer = null;
  }
  get about() {
    return "True sight allows the user to see which color manas are correct for cast attempts in 30 seconds.";
  }
  cast(player) {}
}

class forcedPalm extends Spell {
  constructor() {
    super();
    this.name = "Forced Palm";
    this.enchanted = null; // who it has been cast on
  }
  get about() {
    return "The next colored magic cast by the enchanted cannot be blocked or nullified";
  }
  cast(player) {}
}

class chaosStorm extends Spell {
  constructor() {
    super();
    this.name = "Chaos Storm";
  }
  get about() {
    return "Summon a storm to swap two casters' items or swap you color mana with another caster";
  }
  cast(player1, player2, itemSwap) {}
}

class darkening extends Spell {
  constructor() {
    super();
    this.name = "The Darkening";
    this.enchanted = null;
    this.activeTimer = null;
  }
  get about() {
    return "Curse another caster such that they cannot see or cast magic for 30 seconds.";
  }
  cast(player) {}
}

/****************
 * State class  *
 ***************/
// currently only handles 5 - 6 players
class State {
  constructor() {
    this.state = 0; // 0 is lobby
    this.players = {};
    this.gameTime = 60 * 7; // countdown for 7 minutes
    this.playColors = [];
    this.playItems = [];
    this.circle = { 1: undefined, 2: undefined, 3: undefined };
    this.vanquishTome = new Set();
    this.anarchyTome = new Set();
    this.demonTome = new Set();
  }
  // Game player functions
  add(uuid, name) {
    let player = new Caster(uuid, name);
    this.players[uuid] = player;
    return uuid;
  }
  kick(uuid) {
    delete this.players[uuid];
  }
  has(uuid) {
    return Object.keys(this.players).includes(uuid);
  }
  cast(uuid, spot) {
    // Player adds color
    this.players[uuid].color;

    // If three colors in circle, check
  }
  uncast(uuid, spot) {
    // Player removes color
  }
  // Game state functions
  start() {
    this.giveColors();
    this.makeTomes();
    this.giveItems();
    this.advanceState();

    // Start counting down
    this.gameTime = startTimer(60 * 7);
  }
  // GET functions
  get playerCount() {
    return Object.keys(this.players).length;
  }
  get playerList() {
    let cast = [];
    for (let p of Object.keys(this.players)) {
      cast.push(this.players[p].name);
    }
    return cast;
  }
  get playerColorList() {
    let cast = [];
    for (let p of Object.keys(this.players)) {
      cast.push([this.players[p].name, this.players[p].color]);
    }
    return cast;
  }
  get playerIDs() {
    return Object.keys(this.players);
  }
  get time() {
    return this.gameTime;
  }
  // Helper functions
  advanceState() {
    this.state++;
  }
  giveColors() {
    let colorPool = new Set(MANACOLORS);
    // For each player ...
    for (let p of Object.keys(this.players)) {
      // Get random color ...
      let randColor = randFrom(colorPool);

      // Assign color and keep note of colors in play
      this.players[p].assignColor(randColor);
      colorPool.delete(randColor);
      this.playColors.push(randColor);
    }
  }
  makeTomes() {
    let colorPool = new Set(this.playColors);
    let vTome = new Set();
    // Make vanquish tome
    for (let _ of [0, 1, 2]) {
      let randColor = randFrom(colorPool);

      // Add to tome
      vTome.add(randColor);
      colorPool.delete(randColor);
    }
    // Assign tome to game
    this.vanquishTome = vTome;

    // Make other tomes
    this.anarchyTome = makeTome(colorPool, vTome, new Set());
    this.demonTome = makeTome(colorPool, vTome, this.anarchyTome);
  }
  giveItems() {
    let itemPool = new Set();

    // Add items to pool
    itemPool.add(new aTome(new Set(this.anarchyTome), "the Anarchist"));
    itemPool.add(new trueSight());
    itemPool.add(new forcedPalm());
    itemPool.add(new holyPurity());
    itemPool.add(new chaosStorm());
    itemPool.add(new darkening());

    // Pick items to put in play
    let i = itemPool.size - this.playerCount + 1;
    while (i > 0) {
      itemPool.delete(randFrom(itemPool));
      i--;
    }

    // Add demon tome
    itemPool.add(new aTome(new Set(this.demonTome), "the Summoner"));

    // Randomly distribute
    for (let p of Object.keys(this.players)) {
      let item = randFrom(itemPool);
      this.players[p].give(item);
      itemPool.delete(item);
      if (item instanceof aTome) {
        this.players[p].role = item.role;
      } else {
        this.players[p].role = "a Guardian";
      }
    }
  }
}

// Export
module.exports = {
  generateUID: generateUID,
  generatePlayerUUID: generatePlayerUUID,
  randFrom: randFrom,
  startTimer: startTimer,
  Caster: Caster,
  State: State
};

// ─── TILE TYPES ───
export const T = {
  FLOOR: 0,
  WALL: 1,
  DOOR: 2,
  TABLE: 5,
  CHEST: 6,
  BARREL: 7,
  RUG: 8,
  TORCH: 9,
  COUNTER: 11,
  SHELF: 12,
  WEAPON_RACK: 13,
  PILLAR: 14,
  CARPET_V: 15,
};

export const TILE_SIZE = 50;

export const WALKABLE = new Set([T.FLOOR, T.DOOR, T.RUG, T.CARPET_V]);

export const DIRECTIONS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const KEY_MAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  z: "up",
  s: "down",
  a: "left",
  q: "left",
  d: "right",
};

export const INTERACT_KEYS = new Set(["e", " ", "Enter"]);

// ─── GAME STATES ───
export const SCENE = {
  TITLE: "title",
  GUILD: "guild",
  QUEST: "quest",
  COMBAT: "combat",
};

// ─── PLAYER DEFAULTS ───
export const DEFAULT_PLAYER = {
  name: "Mercenary",
  hp: 100,
  maxHp: 100,
  atk: 5,
  def: 3,
  gold: 0,
  level: 1,
  xp: 0,
  potions: 0,
  inventory: [],
  ingredients: [],
  craftedGear: [],
};

import { T } from "./constants";

// ─── GUILD MAP (14 wide × 10 tall) ───
export const GUILD_MAP = [
  [1, 1, 9, 1, 1, 1, 1, 1, 1, 1, 1, 9, 1, 1],
  [1, 12,0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13,1],
  [1, 0, 0, 0, 0, 15,0, 0, 15,0, 0, 11,11,1],
  [1, 0, 5, 5, 0, 15,0, 0, 15,0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 15,8, 8, 15,0, 0, 0, 0, 1],
  [1, 14,0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 14,1],
  [1, 0, 7, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 1],
  [1, 0, 7, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1],
];

export const GUILD_START = { x: 6, y: 7 };

// ─── NPCs ───
export const NPCS = [
  {
    id: "varek",
    x: 5,
    y: 3,
    type: "quest",
    name: "Commander Varek",
    title: "Contract Giver",
    colors: { body: "#4a6080", head: "#d4a870", accent: "#c0392b", icon: "⚔" },
  },
  {
    id: "forge",
    x: 11,
    y: 2,
    type: "armor",
    name: "Forge-Marteau",
    title: "Armorer",
    colors: { body: "#705030", head: "#d4a870", accent: "#8b6914", icon: "🔨" },
  },
];

// ─── STATIC DIALOGUES (fallback) ───
export const DIALOGUES = {
  quest: [
    { speaker: "Commander Varek", text: "Welcome to the Ash Guild, mercenary. We always need blades around here." },
    { speaker: "Commander Varek", text: "I've got contracts on the board. Exterminations, escorts, retrievals... Take your pick." },
    { speaker: "Commander Varek", text: "Brumesombre Forest has been trouble lately. Creatures prowling too close to the village. Interested?" },
    { speaker: "Commander Varek", text: "Gear up at Forge-Marteau's before heading out. A dead mercenary earns the guild nothing." },
  ],
  armor: [
    { speaker: "Forge-Marteau", text: "*strikes the anvil* ... Hm? You need equipment?" },
    { speaker: "Forge-Marteau", text: "Bring me components from your missions. Fangs, scales, ores... I can work with those." },
    { speaker: "Forge-Marteau", text: "I've got a short sword and a wooden shield in stock. Nothing fancy, but they get the job done." },
    { speaker: "Forge-Marteau", text: "Come back when you've got interesting materials. Then I can forge the real stuff." },
  ],
  door: [
    { speaker: "Guild Door", text: "The door leads to the lands of Cendrebourg. Accept a contract from Commander Varek first." },
  ],
  chest: [
    { speaker: "Guild Chest", text: "The guild's common chest. Empty for now — bring back loot from your missions." },
  ],
};

// ─── INTERACTABLE TILES ───
export const TILE_INTERACTIONS = {
  [T.DOOR]: "door",
  [T.CHEST]: "chest",
};

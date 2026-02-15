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
    name: "Commandant Varek",
    title: "Donneur de contrats",
    colors: { body: "#4a6080", head: "#d4a870", accent: "#c0392b", icon: "⚔" },
  },
  {
    id: "forge",
    x: 11,
    y: 2,
    type: "armor",
    name: "Forge-Marteau",
    title: "Armurier",
    colors: { body: "#705030", head: "#d4a870", accent: "#8b6914", icon: "🔨" },
  },
];

// ─── STATIC DIALOGUES (will be replaced by AI in Session 2) ───
export const DIALOGUES = {
  quest: [
    {
      speaker: "Commandant Varek",
      text: "Bienvenue à la Guilde des Cendres, mercenaire. On a toujours besoin de lames ici.",
    },
    {
      speaker: "Commandant Varek",
      text: "J'ai des contrats sur le tableau. Exterminations, escortes, récupérations... Le choix ne manque pas.",
    },
    {
      speaker: "Commandant Varek",
      text: "La forêt de Brumesombre pose problème ces derniers temps. Des créatures rôdent trop près du village. Ça t'intéresse ?",
    },
    {
      speaker: "Commandant Varek",
      text: "Équipe-toi chez Forge-Marteau avant de partir. Un mercenaire mort ne rapporte rien à la guilde.",
    },
  ],
  armor: [
    {
      speaker: "Forge-Marteau",
      text: "*frappe l'enclume* ... Hm ? Tu veux du matériel ?",
    },
    {
      speaker: "Forge-Marteau",
      text: "Rapporte-moi des composants de tes missions. Crocs, écailles, minerais... Je peux en faire quelque chose.",
    },
    {
      speaker: "Forge-Marteau",
      text: "J'ai une épée courte et un bouclier en bois en stock. C'est pas du luxe, mais ça fait le travail.",
    },
    {
      speaker: "Forge-Marteau",
      text: "Reviens me voir quand t'auras du matériau intéressant. Là je pourrai forger du vrai équipement.",
    },
  ],
  door: [
    {
      speaker: "Porte de la guilde",
      text: "La porte mène vers les terres de Cendrebourg. Accepte d'abord un contrat auprès du Commandant Varek.",
    },
  ],
  chest: [
    {
      speaker: "Coffre de la guilde",
      text: "Le coffre commun de la guilde. Vide pour l'instant — rapporte du butin de tes missions.",
    },
  ],
};

// ─── INTERACTABLE TILES ───
export const TILE_INTERACTIONS = {
  [T.DOOR]: "door",
  [T.CHEST]: "chest",
};

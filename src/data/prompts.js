// ─── WORLD CONTEXT (shared across prompts) ───
const WORLD = `Tu es dans l'univers de Cendrebourg, un village médiéval-fantasy au croisement des routes.
Le Seigneur Varen dirige la région, conseillé par le mystérieux Theron.
La Guilde des Cendres est une compagnie de mercenaires basée dans le village.
Factions : Garde de Cendrebourg, Lames Grises (mercenaires), Cercle d'Obsidienne (occulte), Marchands du Carrefour.
Lieux dangereux : Forêt de Brumesombre (disparitions), Ruines du Nord (évitées), Mine abandonnée, Marais de Valtorve.
Menaces : des créatures rôdent, des rituels occultes ont lieu, un nécromancien serait actif.`;

// ─── QUEST GENERATION ───
export const QUEST_SYSTEM_PROMPT = `${WORLD}

Tu es le Commandant Varek, chef de la Guilde des Cendres. Tu parles avec autorité mais sans être pompeux. Tu tutoies le mercenaire. Tu es direct, pragmatique, et parfois sarcastique.

## TA MISSION
Génère UN contrat de mercenaire. Le contrat doit être court, original, et lié au lore de Cendrebourg.

## RÈGLES
- Adapte la difficulté au niveau du joueur
- Chaque quête a un objectif clair et un twist ou un dilemme moral
- Varie les types : extermination, escorte, investigation, récupération, infiltration
- NE PAS répéter une quête déjà faite (voir historique)
- Le contrat doit pouvoir se résoudre dans une seule zone

## FORMAT (JSON strict, rien d'autre)
{
  "intro": "1-2 phrases de Varek qui présente le contrat (en dialogue, avec son ton)",
  "title": "Nom court et évocateur du contrat",
  "description": "3-4 phrases décrivant la situation, l'objectif, et l'enjeu",
  "type": "extermination|escorte|investigation|recuperation|infiltration",
  "location": "brumesombre|ruines_nord|mine|marais|route_commerce|village_est",
  "location_name": "Nom lisible du lieu",
  "difficulty": 1-5,
  "objectives": ["objectif principal", "objectif optionnel"],
  "reward_gold": nombre entre 20 et 200,
  "reward_xp": nombre entre 10 et 50,
  "moral_choice": "Un dilemme en une phrase (ou null si pas de dilemme)",
  "enemy_hint": "Indice sur le type d'ennemi à affronter"
}`;

export function buildQuestUserMessage(player, questHistory) {
  const history = questHistory.length > 0
    ? `Quêtes déjà accomplies : ${questHistory.map(q => q.title).join(", ")}.`
    : "C'est sa première mission.";

  return `Le mercenaire est niveau ${player.level}, ATK ${player.atk}, DEF ${player.def}. ${history} Génère un nouveau contrat adapté.`;
}

// ─── ARMORER DIALOGUE ───
export const ARMORER_ITEMS = [
  { id: "sword_short", name: "Épée courte", desc: "Lame simple mais fiable", stat: "atk", bonus: 2, cost: 30 },
  { id: "shield_wood", name: "Bouclier en bois", desc: "Protection basique", stat: "def", bonus: 2, cost: 25 },
  { id: "leather_armor", name: "Armure de cuir", desc: "Souple et résistante", stat: "def", bonus: 3, cost: 50 },
  { id: "iron_sword", name: "Épée de fer", desc: "Forge solide, bonne allonge", stat: "atk", bonus: 4, cost: 80 },
  { id: "chainmail", name: "Cotte de mailles", desc: "Protection sérieuse", stat: "def", bonus: 5, cost: 120 },
  { id: "health_potion", name: "Potion de soin", desc: "Restaure 30 PV", stat: "hp", bonus: 30, cost: 15 },
];

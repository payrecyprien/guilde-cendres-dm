// ─── WORLD CONTEXT (shared across prompts) ───
// Minimal static fallback — used when RAG retrieval is unavailable
const WORLD = `You are in the world of Ashburg, a medieval-fantasy village at a crossroads.
Lord Varen rules the region, advised by the enigmatic Theron.
The Ash Guild is a mercenary company based in the village.
Factions: Ashburg Guard, Grey Blades (mercenaries), Obsidian Circle (occult), Crossroads Merchants.
Dangerous locations: Gloomhaze Forest (disappearances), Northern Ruins (avoided by all), Abandoned Mine, Grimfen Marshes.
Threats: creatures roam the wilds, occult rituals are taking place, a necromancer is rumored to be active.`;

// ─── RAG: Format retrieved lore entries for prompt injection ───
export function formatRetrievedLore(entries) {
  if (!entries || entries.length === 0) return "";
  const formatted = entries.map((e) =>
    `[${e.category.toUpperCase()}] ${e.title}: ${e.content}`
  ).join("\n\n");
  return `\n## WORLD KNOWLEDGE (retrieved from lore database — use ONLY these details)\n${formatted}\n`;
}

// Build the world context: use retrieved lore if available, static WORLD as fallback
function buildWorldContext(retrievedLore) {
  if (retrievedLore && retrievedLore.length > 0) {
    return `You are in the world of Ashburg, a medieval-fantasy village at a crossroads. The Ash Guild is a mercenary company operating from this village.\n${formatRetrievedLore(retrievedLore)}`;
  }
  return WORLD;
}

// Shared writing style constraint injected into every narrative prompt
const STYLE = `
## WRITING STYLE (mandatory)
- NEVER use em-dashes (—), semicolons, or ellipsis (...) except in dialogue trailing off
- NEVER use "a testament to", "dance of", "symphony of", "tapestry of", "the very", "mere", "whilst", "yet"
- NEVER start sentences with "As", "With", "Having", "In a", "The air", "A sense of"
- Avoid purple prose: no "sends shivers", "echoes through", "piercing gaze", "looming shadow", "etched with"
- Use short, punchy sentences. Fragments are fine. Write like a terse novelist, not a chatbot.
- Prefer active voice. Prefer concrete verbs over abstract ones. "The blade cuts" not "the blade dances"`;

// ─── QUEST GENERATION ───
export const QUEST_SYSTEM_PROMPT = buildQuestSystemPrompt(); // static fallback for backward compat

export function buildQuestSystemPrompt(retrievedLore) {
  return `${buildWorldContext(retrievedLore)}

You are Commander Varek, leader of the Ash Guild. You speak with authority but without pomposity. You address the mercenary informally. You are direct, pragmatic, and occasionally sarcastic.

## YOUR MISSION
Generate ONE mercenary contract. The contract must be short, original, and tied to Ashburg's lore.

## REASONING (mandatory)
Before generating the contract, think step by step:
1. What quest types has the player NOT done yet? Pick one they haven't seen.
2. What location fits that quest type and hasn't been used recently?
3. What difficulty is appropriate for their level and stats?
4. What twist or moral dilemma would make this quest memorable?
Write this reasoning in the "reasoning" field. It won't be shown to the player — it's for developer analysis.

## RULES
- Adapt difficulty to the player's level
- Each quest has a clear objective and a twist or moral dilemma
- Vary quest types: extermination, escort, investigation, retrieval, infiltration
- ALL quests contain enemies to fight, even investigation or escort quests
- DO NOT repeat a previously completed quest (see history)
- The contract must be resolvable within a single zone
${STYLE}

## FORMAT (strict JSON, nothing else)
{
  "reasoning": "Step-by-step reasoning: why this quest type, location, difficulty, and twist (2-4 sentences)",
  "intro": "1-2 sentences from Varek presenting the contract (in dialogue, with his tone)",
  "title": "Short evocative contract name",
  "description": "3-4 sentences describing the situation, objective, and stakes",
  "type": "extermination|escort|investigation|retrieval|infiltration",
  "location": "gloomhaze|northern_ruins|mine|marshes|trade_road|east_village",
  "location_name": "Readable location name",
  "difficulty": 1-5,
  "objectives": ["main objective", "optional objective"],
  "reward_gold": number between 20 and 200,
  "reward_xp": number between 10 and 50,
  "moral_choice": "A dilemma in one sentence (or null if none)",
  "enemy_hint": "Hint about the type of enemy to face"
}`;
}

export function buildQuestUserMessage(player, questHistory) {
  const history = questHistory.length > 0
    ? `Completed quests: ${questHistory.map(q => `"${q.title}" (${q.type}, ${q.location})`).join(", ")}.`
    : "This is their first mission. No quest history yet.";

  const usedTypes = [...new Set(questHistory.map(q => q.type))];
  const usedLocations = [...new Set(questHistory.map(q => q.location))];
  const typeHint = usedTypes.length > 0 ? ` Types already seen: ${usedTypes.join(", ")}.` : "";
  const locHint = usedLocations.length > 0 ? ` Locations already visited: ${usedLocations.join(", ")}.` : "";

  return `The mercenary is level ${player.level}, ATK ${player.atk}, DEF ${player.def}. ${history}${typeHint}${locHint} Generate a new adapted contract. Think step by step in the reasoning field before deciding.`;
}

// ─── COMBAT NARRATION ───
export const COMBAT_SYSTEM_PROMPT = `You are the combat narrator of a medieval-fantasy RPG set in the world of Ashburg.

## YOUR ROLE
Narrate combat exchanges with intensity and variety. Describe both the player's action AND the monster's retaliation in a single turn.

## RULES
- Write in English, 2nd person for the player ("you")
- Be concise: 2-3 sentences per action max
- Vary descriptions (don't always say "you strike", "you dodge")
- Integrate the monster's context and the location
- If the player defends, describe the defensive stance and damage reduction
- If the player flees, describe the attempt (successful or not)
- Add visceral and atmospheric details
${STYLE}

## FORMAT (strict JSON, nothing else)
{
  "player_action_text": "Description of the player's action (1-2 sentences)",
  "monster_action_text": "Description of the monster's retaliation (1-2 sentences)",
  "ambient_text": "Optional atmospheric detail, or null"
}`;

export function buildCombatUserMessage({ playerAction, playerStats, monsterStats, monsterName, monsterDesc, turnNumber, location }) {
  return `Turn ${turnNumber}. Location: ${location || "unknown zone"}.
Player: HP ${playerStats.hp}/${playerStats.maxHp}, ATK ${playerStats.atk}, DEF ${playerStats.def}. Action: ${playerAction}.
Monster "${monsterName}": HP ${monsterStats.hp}, ATK ${monsterStats.atk}, DEF ${monsterStats.def}. ${monsterDesc || ""}
Narrate this turn.`;
}

// ─── ARMORER DIALOGUE ───
export const ARMORER_ITEMS = [
  { id: "sword_short", name: "Short Sword", desc: "Simple but reliable blade", stat: "atk", bonus: 2, cost: 30 },
  { id: "shield_wood", name: "Wooden Shield", desc: "Basic protection", stat: "def", bonus: 2, cost: 25 },
  { id: "leather_armor", name: "Leather Armor", desc: "Flexible and sturdy", stat: "def", bonus: 3, cost: 50 },
  { id: "iron_sword", name: "Iron Sword", desc: "Solid forge, good reach", stat: "atk", bonus: 4, cost: 80 },
  { id: "chainmail", name: "Chainmail", desc: "Serious protection", stat: "def", bonus: 5, cost: 120 },
  { id: "health_potion", name: "Health Potion", desc: "Restores 30 HP", stat: "hp", bonus: 30, cost: 15 },
];

// ─── CRAFTING ───
export const CRAFT_SYSTEM_PROMPT = `You are Ironhammer, a gruff but talented armorer in the Ash Guild of Ashburg. A mercenary brings you monster parts to forge into equipment.

## YOUR ROLE
Create a unique piece of equipment from the given ingredients. The item should feel thematically connected to the ingredients used.

## RULES
- Name should be evocative and unique (2-3 words max)
- Description is 1 short atmospheric sentence, in Ironhammer's voice
- stat must be either "atk" or "def"
- bonus is between 1 and 6, proportional to ingredient tier (T1 ingredients = 1-3 bonus, T2 = 3-6)
- Higher tier ingredients = better results
${STYLE}

## FORMAT (strict JSON, nothing else)
{
  "name": "Shadowfang Blade",
  "description": "*tests the edge* This thing practically bites back. Good hunting.",
  "stat": "atk",
  "bonus": 4
}`;

export function buildCraftUserMessage(ingredients) {
  const list = ingredients.map(i => `${i.name} (Tier ${i.tier})`).join(", ");
  return `Forge an item from these ingredients: ${list}. Respond with the crafted item JSON.`;
}

// ─── NPC CONTEXTUAL DIALOGUE ───
export const VAREK_DIALOGUE_PROMPT = `You are Commander Varek, leader of the Ash Guild in Ashburg. You are direct, pragmatic, occasionally sarcastic, and address the mercenary informally. You speak like a battle-hardened veteran.
${STYLE}
Write a SINGLE short greeting (1-2 sentences max). No quotes around it. Be varied and natural.`;

export function buildVarekDialogueMessage(context) {
  const parts = [`Mercenary is level ${context.level}, HP ${context.hp}/${context.maxHp}, ${context.gold} gold.`];
  if (context.lastResult === "victory") parts.push("They just returned victorious from a quest.");
  if (context.lastResult === "defeat") parts.push("They just got defeated and returned empty-handed.");
  if (context.questCount === 0) parts.push("This is their first time at the guild.");
  else parts.push(`They've completed ${context.questCount} quests so far.`);
  if (context.hp < context.maxHp * 0.4) parts.push("They look badly wounded.");
  parts.push("Greet them in character. 1-2 sentences, no more.");
  return parts.join(" ");
}

export const IRONHAMMER_DIALOGUE_PROMPT = `You are Ironhammer, the armorer of the Ash Guild in Ashburg. You are gruff, laconic, and communicate partly through actions (written with *asterisks*). You care about your craft above all else.
${STYLE}
Write a SINGLE short greeting (1-2 sentences max). No quotes around it. Be varied and natural.`;

export function buildIronhammerDialogueMessage(context) {
  const parts = [`Mercenary is level ${context.level}, HP ${context.hp}/${context.maxHp}.`];
  if (context.ingredients > 0) parts.push(`They're carrying ${context.ingredients} monster materials.`);
  if (context.gearCount > 0) parts.push(`They have ${context.gearCount} pieces of forged equipment.`);
  if (context.hp < context.maxHp * 0.4) parts.push("They look badly injured.");
  if (context.inventoryCount >= 4) parts.push("They're well-equipped from the shop.");
  parts.push("Greet them in character. 1-2 sentences, no more.");
  return parts.join(" ");
}

// ─── DUNGEON MASTER AGENT ───

export const DM_SYSTEM_PROMPT = buildDMSystemPrompt(); // static fallback

export function buildDMSystemPrompt(retrievedLore) {
  return `${buildWorldContext(retrievedLore)}

You are the Dungeon Master — an invisible hand shaping the player's exploration in real-time. You observe the game state and decide whether to intervene using one of your tools, or do nothing.

## YOUR ROLE
You are NOT a narrator who comments on everything. You are a game director who intervenes ONLY when it serves pacing, tension, or player engagement. Long stretches of silence are fine. Not every trigger needs an event.

## DECISION PRINCIPLES
- **Pacing first.** If the player just had a dramatic moment, let them breathe. If things have been quiet, escalate.
- **React to player state.** A wounded player might find a hidden supply. An overpowered player might face an ambush.
- **Serve the quest narrative.** Your events should feel connected to the quest, not random.
- **No repetition.** Check the DM history. Don't spawn a monster if you just spawned one. Don't narrate if you just narrated.
- **Restraint is a skill.** Using no_action is often the best choice. Overintervening ruins immersion.

## TOOL GUIDELINES
- **narrate_event**: Atmosphere, warnings, discoveries. Short and punchy. Use sparingly.
- **spawn_monster**: Ambushes or reinforcements. Scale stats to player level. Don't spawn if the player is already struggling.
- **offer_choice**: Moral dilemmas or risk/reward. Both options must be interesting. Don't make one obviously better.
- **drop_supply**: Mercy drops for struggling players, or hidden rewards. Don't trivialize difficulty.
- **no_action**: When pacing is good, when intervening would feel forced, or when the player needs space. Always valid.

## BALANCE RULES
- spawn_monster HP should be between 60% and 120% of player's current HP
- spawn_monster ATK should be close to player ATK (±2)
- offer_choice effect_value: heal 15-40, gold 10-50, buff 1-2
- drop_supply: only when player HP < 40% or potions = 0
${STYLE}

You have access to tools. You MUST call exactly one tool per response. Choose wisely.`;
}

export function buildDMUserMessage(context) {
  const parts = [];

  // Trigger type
  parts.push(`## TRIGGER: ${context.trigger}`);

  // Player state
  parts.push(`## PLAYER STATE`);
  parts.push(`Level ${context.level}, HP ${context.hp}/${context.maxHp} (${Math.round(context.hp / context.maxHp * 100)}%), ATK ${context.atk}, DEF ${context.def}.`);
  parts.push(`Gold: ${context.gold}. Potions: ${context.potions}.`);
  if (context.ingredients > 0) parts.push(`Carrying ${context.ingredients} crafting materials.`);

  // Quest context
  parts.push(`## QUEST`);
  parts.push(`"${context.questTitle}" — ${context.questType} mission in ${context.locationName}.`);
  if (context.questDescription) parts.push(context.questDescription);

  // Zone state
  parts.push(`## ZONE STATE`);
  parts.push(`Monsters remaining: ${context.monstersRemaining}/${context.monstersTotal}.`);
  parts.push(`Difficulty: ${context.difficulty}/5.`);

  // DM history (what the agent already did this zone)
  if (context.dmHistory && context.dmHistory.length > 0) {
    parts.push(`## YOUR PREVIOUS DECISIONS THIS ZONE`);
    context.dmHistory.forEach((h, i) => {
      parts.push(`${i + 1}. [${h.trigger}] → ${h.tool}${h.tool !== "no_action" ? `: ${h.summary}` : ""}`);
    });
  } else {
    parts.push(`## YOUR PREVIOUS DECISIONS THIS ZONE`);
    parts.push(`None yet. This is your first intervention opportunity.`);
  }

  parts.push(`\nDecide: which tool do you use, or no_action?`);
  return parts.join("\n");
}

// ─── RAG RETRIEVAL QUERY BUILDERS ───

export function buildQuestRetrievalQuery(player, questHistory) {
  const parts = ["Ashburg mercenary quest"];
  // Add locations not yet visited
  const usedLocations = new Set(questHistory.map(q => q.location));
  const allLocations = ["gloomhaze", "northern_ruins", "mine", "marshes", "trade_road", "east_village"];
  const fresh = allLocations.filter(l => !usedLocations.has(l));
  if (fresh.length > 0) parts.push(fresh.join(" "));
  // Add quest types not yet done
  const usedTypes = new Set(questHistory.map(q => q.type));
  const allTypes = ["extermination", "escort", "investigation", "retrieval", "infiltration"];
  const freshTypes = allTypes.filter(t => !usedTypes.has(t));
  if (freshTypes.length > 0) parts.push(freshTypes.join(" "));
  // Player level context
  if (player.level >= 3) parts.push("advanced threats obsidian circle necromancer");
  else parts.push("creatures dangers threats");
  return parts.join(" ");
}

export function buildDMRetrievalQuery(context) {
  const parts = [];
  parts.push(context.locationName || "Ashburg");
  parts.push(context.questType || "extermination");
  if (context.questTitle) parts.push(context.questTitle);
  if (context.trigger === "player_wounded") parts.push("danger threat survival");
  if (context.trigger === "zone_cleared") parts.push("discovery reward secret");
  if (context.monstersRemaining <= 1) parts.push("final encounter climax");
  return parts.join(" ");
}

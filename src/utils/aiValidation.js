/**
 * AI Output Validation Layer
 * Validates and auto-fixes AI responses before they reach the game.
 */

const VALID_LOCATIONS = ["gloomhaze", "northern_ruins", "mine", "marshes", "trade_road", "east_village"];
const VALID_TYPES = ["extermination", "escort", "investigation", "retrieval", "infiltration"];

/**
 * Validate a quest object
 */
export function validateQuest(quest) {
  const issues = [];
  const fixes = [];

  if (!quest.title || quest.title.length < 2) {
    issues.push("Missing or too short title");
  }
  if (!quest.description) {
    issues.push("Missing description");
  }
  if (!VALID_LOCATIONS.includes(quest.location)) {
    fixes.push(`Invalid location "${quest.location}" → defaulted to "gloomhaze"`);
    quest.location = "gloomhaze";
    quest.location_name = "Gloomhaze Forest";
  }
  if (!VALID_TYPES.includes(quest.type)) {
    fixes.push(`Invalid type "${quest.type}" → defaulted to "extermination"`);
    quest.type = "extermination";
  }
  if (typeof quest.difficulty !== "number" || quest.difficulty < 1 || quest.difficulty > 5) {
    fixes.push(`Difficulty ${quest.difficulty} out of range → clamped`);
    quest.difficulty = Math.max(1, Math.min(5, quest.difficulty || 1));
  }
  if (typeof quest.reward_gold !== "number" || quest.reward_gold < 5 || quest.reward_gold > 500) {
    fixes.push(`Gold reward ${quest.reward_gold} out of range → clamped`);
    quest.reward_gold = Math.max(5, Math.min(500, quest.reward_gold || 50));
  }
  if (typeof quest.reward_xp !== "number" || quest.reward_xp < 5 || quest.reward_xp > 100) {
    fixes.push(`XP reward ${quest.reward_xp} out of range → clamped`);
    quest.reward_xp = Math.max(5, Math.min(100, quest.reward_xp || 20));
  }
  if (!Array.isArray(quest.objectives) || quest.objectives.length === 0) {
    fixes.push("Missing objectives → added default");
    quest.objectives = ["Complete the contract"];
  }

  return {
    valid: issues.length === 0 && fixes.length === 0,
    issues,
    fixes,
    summary: issues.length === 0 && fixes.length === 0
      ? "✅ All checks passed"
      : `⚠️ ${issues.length} issue${issues.length !== 1 ? "s" : ""}, ${fixes.length} fix${fixes.length !== 1 ? "es" : ""} applied`,
  };
}

/**
 * Validate a zone object (variable grid sizes)
 */
export function validateZone(zone) {
  const issues = [];
  const fixes = [];

  if (!Array.isArray(zone.grid) || zone.grid.length < 8) {
    issues.push(`Grid has ${zone.grid?.length || 0} rows (minimum 8)`);
  } else {
    const expectedW = zone.grid[0]?.length || 14;

    // Check row widths consistency
    zone.grid.forEach((row, i) => {
      if (row.length !== expectedW) {
        issues.push(`Row ${i} has ${row.length} cols, expected ${expectedW}`);
      }
    });

    // Check entry exists
    const lastRow = zone.grid[zone.grid.length - 1] || [];
    const hasEntry = lastRow.includes(3);
    if (!hasEntry) {
      const midX = Math.floor(expectedW / 2);
      fixes.push(`Missing entry tile → injected at (${midX},${zone.grid.length - 1})`);
      if (zone.grid[zone.grid.length - 1]) zone.grid[zone.grid.length - 1][midX] = 3;
    }

    // Check objective exists
    let hasObjective = false;
    for (let y = 0; y < zone.grid.length; y++) {
      if (zone.grid[y].includes(4)) { hasObjective = true; break; }
    }
    if (!hasObjective) {
      const objX = Math.floor(expectedW / 2) + 1;
      fixes.push(`Missing objective tile → injected at (${objX},2)`);
      if (zone.grid[2]) zone.grid[2][objX] = 4;
    }
  }

  // Validate monsters
  if (!Array.isArray(zone.monsters)) {
    fixes.push("Missing monsters array → defaulted to empty");
    zone.monsters = [];
  } else {
    zone.monsters.forEach((m, i) => {
      if (typeof m.hp !== "number" || m.hp < 1) {
        fixes.push(`Monster ${i} HP invalid → set to 25`);
        m.hp = 25;
      }
      if (typeof m.atk !== "number" || m.atk < 1) {
        fixes.push(`Monster ${i} ATK invalid → set to 5`);
        m.atk = 5;
      }
      if (typeof m.def !== "number" || m.def < 0) {
        fixes.push(`Monster ${i} DEF invalid → set to 2`);
        m.def = 2;
      }
      // Check position is on floor
      if (zone.grid?.[m.y]?.[m.x] !== 0) {
        fixes.push(`Monster "${m.name}" at (${m.x},${m.y}) not on floor tile`);
      }
    });
  }

  return {
    valid: issues.length === 0 && fixes.length === 0,
    issues,
    fixes,
    summary: issues.length === 0 && fixes.length === 0
      ? "✅ All checks passed"
      : `⚠️ ${issues.length} issue${issues.length !== 1 ? "s" : ""}, ${fixes.length} fix${fixes.length !== 1 ? "es" : ""} applied`,
  };
}

/**
 * Validate combat narration
 */
export function validateNarration(narration) {
  const issues = [];
  const fixes = [];

  if (!narration.player_action_text) {
    fixes.push("Missing player_action_text → added fallback");
    narration.player_action_text = "You act swiftly.";
  }
  if (!narration.monster_action_text) {
    fixes.push("Missing monster_action_text → added fallback");
    narration.monster_action_text = "The creature retaliates.";
  }

  // Check for AI slop markers
  const slopPatterns = [/—/g, /tapestry of/i, /symphony of/i, /a testament to/i, /sends shivers/i];
  const allText = `${narration.player_action_text} ${narration.monster_action_text} ${narration.ambient_text || ""}`;
  slopPatterns.forEach((pattern) => {
    if (pattern.test(allText)) {
      issues.push(`AI slop detected: ${pattern.source}`);
    }
  });

  // Length check
  if (narration.player_action_text.length > 300) {
    fixes.push("player_action_text too long → truncated");
    narration.player_action_text = narration.player_action_text.slice(0, 297) + "...";
  }
  if (narration.monster_action_text.length > 300) {
    fixes.push("monster_action_text too long → truncated");
    narration.monster_action_text = narration.monster_action_text.slice(0, 297) + "...";
  }

  return {
    valid: issues.length === 0 && fixes.length === 0,
    issues,
    fixes,
    summary: issues.length === 0 && fixes.length === 0
      ? "✅ All checks passed"
      : `⚠️ ${issues.length} issue${issues.length !== 1 ? "s" : ""}, ${fixes.length} fix${fixes.length !== 1 ? "es" : ""} applied`,
  };
}

/**
 * Validate crafted item
 */
export function validateCraftedItem(item) {
  const issues = [];
  const fixes = [];

  if (!item.name || item.name.length < 2) {
    fixes.push("Missing item name → added default");
    item.name = "Crude Alloy";
  }
  if (!["atk", "def"].includes(item.stat)) {
    fixes.push(`Invalid stat "${item.stat}" → defaulted to "atk"`);
    item.stat = "atk";
  }
  if (typeof item.bonus !== "number" || item.bonus < 1 || item.bonus > 6) {
    fixes.push(`Bonus ${item.bonus} out of range → clamped 1-6`);
    item.bonus = Math.max(1, Math.min(6, item.bonus || 2));
  }

  return {
    valid: issues.length === 0 && fixes.length === 0,
    issues,
    fixes,
    summary: issues.length === 0 && fixes.length === 0
      ? "✅ All checks passed"
      : `⚠️ ${issues.length} issue${issues.length !== 1 ? "s" : ""}, ${fixes.length} fix${fixes.length !== 1 ? "es" : ""} applied`,
  };
}

/**
 * Validate Dungeon Master agent decision
 */
const VALID_DM_TOOLS = ["narrate_event", "spawn_monster", "offer_choice", "drop_supply", "no_action"];
const VALID_CHOICE_EFFECTS = ["heal", "gold", "spawn_monster", "ingredient", "buff_atk", "buff_def"];

export function validateDMDecision(decision) {
  const issues = [];
  const fixes = [];

  if (!decision || !decision.tool) {
    issues.push("Missing tool decision");
    return { valid: false, issues, fixes, summary: "❌ No tool decision returned" };
  }

  if (!VALID_DM_TOOLS.includes(decision.tool)) {
    issues.push(`Unknown tool "${decision.tool}"`);
    return { valid: false, issues, fixes, summary: `❌ Unknown tool: ${decision.tool}` };
  }

  const input = decision.input || {};

  switch (decision.tool) {
    case "narrate_event":
      if (!input.text || input.text.length < 5) {
        fixes.push("narrate_event text missing or too short → added fallback");
        input.text = input.text || "Something stirs in the shadows.";
      }
      if (!input.speaker) {
        fixes.push("Missing speaker → defaulted");
        input.speaker = "The Darkness";
      }
      // Slop check on DM narration
      [/—/g, /tapestry of/i, /symphony of/i, /a testament to/i, /sends shivers/i].forEach((pattern) => {
        if (pattern.test(input.text || "")) {
          issues.push(`AI slop in DM narration: ${pattern.source}`);
        }
      });
      break;

    case "spawn_monster":
      if (!input.name) { fixes.push("Missing monster name → default"); input.name = "Shadow Lurker"; }
      if (typeof input.hp !== "number" || input.hp < 5) { fixes.push(`Monster HP invalid → 20`); input.hp = 20; }
      if (typeof input.atk !== "number" || input.atk < 1) { fixes.push(`Monster ATK invalid → 4`); input.atk = 4; }
      if (typeof input.def !== "number" || input.def < 0) { fixes.push(`Monster DEF invalid → 2`); input.def = 2; }
      if (typeof input.xp !== "number") { input.xp = 10; fixes.push("Missing XP → 10"); }
      if (typeof input.gold !== "number") { input.gold = 8; fixes.push("Missing gold → 8"); }
      if (!input.narrative) { fixes.push("Missing spawn narrative"); input.narrative = "A creature emerges from the dark."; }
      break;

    case "offer_choice":
      if (!input.prompt_text) { fixes.push("Missing choice prompt"); input.prompt_text = "You face a decision."; }
      for (const key of ["option_a", "option_b"]) {
        const opt = input[key];
        if (!opt) {
          issues.push(`Missing ${key}`);
        } else {
          if (!opt.label) { fixes.push(`${key} missing label`); opt.label = "Choose"; }
          if (!VALID_CHOICE_EFFECTS.includes(opt.effect_type)) {
            fixes.push(`${key} invalid effect "${opt.effect_type}" → "gold"`);
            opt.effect_type = "gold";
          }
          if (typeof opt.effect_value !== "number") { fixes.push(`${key} missing value → 10`); opt.effect_value = 10; }
          if (!opt.narration) { fixes.push(`${key} missing narration`); opt.narration = "Done."; }
        }
      }
      break;

    case "drop_supply":
      if (!["potion", "ingredient"].includes(input.type)) {
        fixes.push(`Invalid supply type "${input.type}" → "potion"`);
        input.type = "potion";
      }
      if (!input.narration) { fixes.push("Missing drop narration"); input.narration = "You find something useful."; }
      break;

    case "no_action":
      if (!input.reasoning) { fixes.push("no_action missing reasoning"); input.reasoning = "No reason provided"; }
      break;
  }

  return {
    valid: issues.length === 0 && fixes.length === 0,
    issues,
    fixes,
    summary: issues.length === 0 && fixes.length === 0
      ? `✅ DM chose: ${decision.tool}`
      : `⚠️ DM chose: ${decision.tool} (${issues.length} issue${issues.length !== 1 ? "s" : ""}, ${fixes.length} fix${fixes.length !== 1 ? "es" : ""})`,
  };
}

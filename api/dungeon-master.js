const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// ─── TOOL DEFINITIONS (the DM's available actions) ───

const DM_TOOLS = [
  {
    name: "narrate_event",
    description:
      "Display a narrative event to the player as a dialogue box. Use for atmospheric beats, warnings, discoveries, or story hooks. Best used to build tension or reward exploration.",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The narrative text (2-3 sentences max, terse style, no em-dashes)",
        },
        speaker: {
          type: "string",
          description:
            'Who or what is "speaking" (e.g. "The Darkness", "A distant voice", "Instinct", "The walls")',
        },
      },
      required: ["text", "speaker"],
    },
  },
  {
    name: "spawn_monster",
    description:
      "Spawn a new monster somewhere on the map. Use for ambushes after the player feels safe, reinforcements when the zone seems too easy, or dramatic encounters tied to the quest narrative. The game will place it on a valid floor tile near the player.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Unique evocative monster name (2-3 words max)",
        },
        description: {
          type: "string",
          description: "One sentence physical description",
        },
        hp: { type: "number", description: "Hit points (scale to player level and difficulty)" },
        atk: { type: "number", description: "Attack stat" },
        def: { type: "number", description: "Defense stat" },
        xp: { type: "number", description: "XP reward on kill" },
        gold: { type: "number", description: "Gold reward on kill" },
        narrative: {
          type: "string",
          description: "Short text shown to the player when the monster appears (1-2 sentences)",
        },
      },
      required: ["name", "description", "hp", "atk", "def", "xp", "gold", "narrative"],
    },
  },
  {
    name: "offer_choice",
    description:
      "Present the player with a meaningful binary choice. Use for moral dilemmas, risk/reward decisions, or narrative branches. Each option has a predefined effect the game will execute.",
    input_schema: {
      type: "object",
      properties: {
        prompt_text: {
          type: "string",
          description: "The situation description (2-3 sentences, set the scene)",
        },
        speaker: {
          type: "string",
          description: 'Who or what presents the choice (e.g. "A wounded creature", "The altar")',
        },
        option_a: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short choice label (3-6 words)" },
            effect_type: {
              type: "string",
              enum: ["heal", "gold", "spawn_monster", "ingredient", "buff_atk", "buff_def"],
              description: "The gameplay effect",
            },
            effect_value: {
              type: "number",
              description: "Magnitude (HP healed, gold gained, stat bonus, etc.)",
            },
            narration: {
              type: "string",
              description: "What the player sees after choosing (1-2 sentences)",
            },
          },
          required: ["label", "effect_type", "effect_value", "narration"],
        },
        option_b: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short choice label (3-6 words)" },
            effect_type: {
              type: "string",
              enum: ["heal", "gold", "spawn_monster", "ingredient", "buff_atk", "buff_def"],
              description: "The gameplay effect",
            },
            effect_value: {
              type: "number",
              description: "Magnitude (HP healed, gold gained, stat bonus, etc.)",
            },
            narration: {
              type: "string",
              description: "What the player sees after choosing (1-2 sentences)",
            },
          },
          required: ["label", "effect_type", "effect_value", "narration"],
        },
      },
      required: ["prompt_text", "speaker", "option_a", "option_b"],
    },
  },
  {
    name: "drop_supply",
    description:
      "Place a supply on the map for the player to find. Use when the player is struggling (low HP, no potions) or as a reward for thorough exploration. The game places it on a nearby floor tile.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["potion", "ingredient"],
          description: "What to drop",
        },
        narration: {
          type: "string",
          description: "Text shown when the player discovers it (1 sentence)",
        },
      },
      required: ["type", "narration"],
    },
  },
  {
    name: "no_action",
    description:
      "Decide that nothing should happen right now. Use when the pacing is already good, when intervening would break immersion, or when the player's situation doesn't warrant it. Good pacing means not every trigger needs an event.",
    input_schema: {
      type: "object",
      properties: {
        reasoning: {
          type: "string",
          description: "Brief explanation of why no action is appropriate (for developer logs)",
        },
      },
      required: ["reasoning"],
    },
  },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const { system, message } = req.body;
  if (!system || !message) return res.status(400).json({ error: "Missing system or message" });

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 600,
        temperature: 0.85,
        system,
        tools: DM_TOOLS,
        tool_choice: { type: "any" },
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("DM API error:", data.error);
      return res.status(200).json({ tool: "no_action", input: { reasoning: "API error" }, reasoning: "" });
    }

    // Extract reasoning (text blocks) and tool decision (tool_use block)
    let reasoning = "";
    let toolName = "no_action";
    let toolInput = { reasoning: "No tool call in response" };

    for (const block of data.content || []) {
      if (block.type === "text") {
        reasoning += block.text;
      }
      if (block.type === "tool_use") {
        toolName = block.name;
        toolInput = block.input;
      }
    }

    return res.status(200).json({
      tool: toolName,
      input: toolInput,
      reasoning,
      raw_stop_reason: data.stop_reason,
    });
  } catch (err) {
    console.error("DM endpoint error:", err);
    return res.status(200).json({
      tool: "no_action",
      input: { reasoning: `Server error: ${err.message}` },
      reasoning: "",
    });
  }
}

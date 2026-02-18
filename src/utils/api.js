import aiLogger from "./aiLogger";
import { validateQuest, validateZone, validateNarration, validateCraftedItem, validateDMDecision } from "./aiValidation";

const API_ENDPOINT = "/api/chat";

/**
 * Parse JSON from LLM response (defensive)
 */
function parseJSON(text) {
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * RAG: Retrieve relevant lore entries from the knowledge base
 * Returns array of {id, title, category, content, tags, score} or []
 */
export async function retrieveLore(query, topK = 6) {
  const logId = aiLogger.start({
    endpoint: "Lore Retrieval (RAG)",
    model: "text-embedding-3-small",
    systemPrompt: "(retrieval — no LLM prompt)",
    userMessage: query,
  });

  try {
    const response = await fetch("/api/retrieve-lore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, topK }),
    });

    const data = await response.json();
    const entries = data.entries || [];

    aiLogger.complete(logId, {
      response: { method: data.method, count: entries.length, entries: entries.map(e => e.title) },
      rawResponse: JSON.stringify(data, null, 2),
      validationResult: {
        valid: entries.length > 0,
        issues: entries.length === 0 ? ["No lore entries retrieved"] : [],
        fixes: [],
        summary: entries.length > 0
          ? `✅ ${entries.length} entries via ${data.method} (${entries.map(e => e.id).join(", ")})`
          : "⚠️ No entries retrieved — using static fallback",
      },
    });

    return entries;
  } catch (err) {
    aiLogger.fail(logId, err);
    return [];
  }
}

/**
 * Generate a quest via AI
 */
export async function generateQuest(systemPrompt, userMessage) {
  const logId = aiLogger.start({
    endpoint: "Quest Generation",
    model: "claude-sonnet-4-5",
    systemPrompt,
    userMessage,
  });

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 600,
        temperature: 0.9,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || data.error);

    const rawText = data.content?.map((b) => b.text || "").join("") || "";
    const quest = parseJSON(rawText);
    if (!quest || !quest.title) throw new Error("Quest parsing failed");

    const validation = validateQuest(quest);
    aiLogger.complete(logId, { response: quest, rawResponse: rawText, validationResult: validation });
    return quest;
  } catch (err) {
    aiLogger.fail(logId, err);
    throw err;
  }
}

/**
 * Generate a quest zone (map + monsters) via AI
 */
export async function generateQuestZone(quest) {
  const logId = aiLogger.start({
    endpoint: "Zone Generation",
    model: "claude-sonnet-4-5",
    systemPrompt: "(server-side prompt with biome context)",
    userMessage: `Quest: "${quest.title}" | Location: ${quest.location} | Difficulty: ${quest.difficulty} | Size scales with difficulty`,
  });

  try {
    const response = await fetch("/api/questzone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quest }),
    });

    const data = await response.json();
    if (data.error && !data.grid) throw new Error(data.error);

    const validation = validateZone(data);
    aiLogger.complete(logId, { response: data, validationResult: validation });
    return data;
  } catch (err) {
    aiLogger.fail(logId, err);
    throw err;
  }
}

/**
 * Get AI combat narration
 */
export async function getCombatNarration(systemPrompt, userMessage) {
  const logId = aiLogger.start({
    endpoint: "Combat Narration",
    model: "claude-haiku-4-5",
    systemPrompt,
    userMessage,
  });

  try {
    const response = await fetch("/api/combat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemPrompt, message: userMessage }),
    });

    const narration = await response.json();
    const validation = validateNarration(narration);
    aiLogger.complete(logId, { response: narration, validationResult: validation });
    return narration;
  } catch (err) {
    aiLogger.fail(logId, err);
    throw err;
  }
}

/**
 * Generate a monster portrait via GPT Image 1
 */
export async function generateMonsterPortrait(monsterName, monsterDescription, biome) {
  const logId = aiLogger.start({
    endpoint: "Monster Portrait",
    model: "gpt-image-1",
    systemPrompt: "Pixel art RPG monster portrait prompt",
    userMessage: `${monsterName}: ${monsterDescription || "unknown"} (biome: ${biome})`,
  });

  try {
    const response = await fetch("/api/monster-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monsterName, monsterDescription, biome }),
    });

    const data = await response.json();
    const url = data.url || null;
    aiLogger.complete(logId, {
      response: url ? "Image generated" : "No image",
      rawResponse: url ? `URL: ${url.slice(0, 80)}...` : "null",
      validationResult: { valid: !!url, issues: url ? [] : ["No image returned"], fixes: [], summary: url ? "✅ Image generated" : "⚠️ No image" },
    });
    return url;
  } catch (err) {
    aiLogger.fail(logId, err);
    return null;
  }
}

/**
 * Craft an item via AI
 */
export async function craftItem(systemPrompt, userMessage) {
  const logId = aiLogger.start({
    endpoint: "Item Crafting",
    model: "claude-sonnet-4-5",
    systemPrompt,
    userMessage,
  });

  try {
    const response = await fetch("/api/craft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemPrompt, message: userMessage }),
    });

    const item = await response.json();
    const validation = validateCraftedItem(item);
    aiLogger.complete(logId, { response: item, validationResult: validation });
    return item;
  } catch (err) {
    aiLogger.fail(logId, err);
    throw err;
  }
}

/**
 * Get AI-generated NPC dialogue (Haiku, fast)
 */
export async function getNPCDialogue(systemPrompt, userMessage) {
  const logId = aiLogger.start({
    endpoint: "NPC Dialogue",
    model: "claude-haiku-4-5",
    systemPrompt,
    userMessage,
  });

  try {
    const response = await fetch("/api/npc-dialogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemPrompt, message: userMessage }),
    });

    const data = await response.json();
    const text = data.text || null;
    aiLogger.complete(logId, {
      response: text,
      rawResponse: text || "(empty response)",
      validationResult: { valid: !!text, issues: text ? [] : ["Empty response"], fixes: [], summary: text ? "✅ Dialogue generated" : "⚠️ Empty, using fallback" },
    });
    return text;
  } catch (err) {
    aiLogger.fail(logId, err);
    return null;
  }
}

/**
 * Call the Dungeon Master agent (Sonnet with function calling)
 * Returns: { tool, input, reasoning }
 */
export async function callDungeonMaster(systemPrompt, userMessage) {
  const logId = aiLogger.start({
    endpoint: "Dungeon Master",
    model: "claude-sonnet-4-5 (agent)",
    systemPrompt,
    userMessage,
  });

  try {
    const response = await fetch("/api/dungeon-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemPrompt, message: userMessage }),
    });

    const data = await response.json();
    const validation = validateDMDecision(data);

    aiLogger.complete(logId, {
      response: data,
      rawResponse: JSON.stringify(data, null, 2),
      validationResult: validation,
    });

    return data;
  } catch (err) {
    aiLogger.fail(logId, err);
    return { tool: "no_action", input: { reasoning: `Client error: ${err.message}` }, reasoning: "" };
  }
}

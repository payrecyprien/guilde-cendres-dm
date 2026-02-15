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
 * Generate a quest via AI
 */
export async function generateQuest(systemPrompt, userMessage) {
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      temperature: 0.9,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || data.error);
  }

  const rawText = data.content?.map((b) => b.text || "").join("") || "";
  const quest = parseJSON(rawText);

  if (!quest || !quest.title) {
    throw new Error("Quest parsing failed");
  }

  return quest;
}

#!/usr/bin/env node
/**
 * build-embeddings.js
 * 
 * Pre-computes OpenAI embeddings for the lore knowledge base.
 * Run once (or after editing lore): node scripts/build-embeddings.js
 * Requires OPENAI_API_KEY environment variable.
 * 
 * Output: api/lore-embeddings.json
 */

const fs = require("fs");
const path = require("path");

const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
const OUTPUT_PATH = path.join(__dirname, "..", "api", "lore-embeddings.json");

// ─── Load lore entries (inline copy to avoid ESM import issues) ───
// This reads from src/data/loreKnowledgeBase.js by parsing the export
function loadLoreEntries() {
  const loreFile = path.join(__dirname, "..", "src", "data", "loreKnowledgeBase.js");
  const content = fs.readFileSync(loreFile, "utf-8");
  
  // Extract the array from the module
  const match = content.match(/const LORE_KNOWLEDGE_BASE = \[([\s\S]*)\];\s*export default/);
  if (!match) throw new Error("Could not parse lore knowledge base");
  
  // Evaluate the array (safe since we control the file)
  const entries = eval(`[${match[1]}]`);
  return entries;
}

async function embedText(text, apiKey) {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: text,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(`OpenAI error: ${data.error.message}`);
  return data.data[0].embedding;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY environment variable not set.");
    console.error("Usage: OPENAI_API_KEY=sk-... node scripts/build-embeddings.js");
    process.exit(1);
  }

  console.log("Loading lore knowledge base...");
  const entries = loadLoreEntries();
  console.log(`Found ${entries.length} entries.`);

  console.log(`\nComputing embeddings via ${MODEL}...`);
  const results = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    // Embed: title + content + tags (gives rich semantic signal)
    const textToEmbed = `${entry.title}. ${entry.content} Tags: ${entry.tags.join(", ")}`;

    try {
      const embedding = await embedText(textToEmbed, apiKey);
      results.push({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        content: entry.content,
        tags: entry.tags,
        embedding,
      });
      process.stdout.write(`  [${i + 1}/${entries.length}] ${entry.id} ✓\n`);
    } catch (err) {
      console.error(`  [${i + 1}/${entries.length}] ${entry.id} ✗ ${err.message}`);
    }

    // Rate limit: small delay between calls
    if (i < entries.length - 1) await new Promise((r) => setTimeout(r, 100));
  }

  // Write output
  const output = {
    model: MODEL,
    generated_at: new Date().toISOString(),
    entry_count: results.length,
    embedding_dimensions: results[0]?.embedding?.length || 0,
    entries: results,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
  const sizeKB = Math.round(fs.statSync(OUTPUT_PATH).size / 1024);
  console.log(`\n✅ Wrote ${results.length} embeddings to ${OUTPUT_PATH} (${sizeKB} KB)`);
  console.log(`Embedding dimensions: ${output.embedding_dimensions}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

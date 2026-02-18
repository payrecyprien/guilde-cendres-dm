import { createRequire } from "module";

const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small";

// ─── Load pre-computed embeddings (if available) ───
let embeddingsData = null;

function loadEmbeddings() {
  if (embeddingsData) return embeddingsData;
  try {
    const require = createRequire(import.meta.url);
    embeddingsData = require("./lore-embeddings.json");
    return embeddingsData;
  } catch {
    return null;
  }
}

// ─── Math utilities ───
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ─── Embedding-based retrieval ───
async function retrieveByEmbedding(query, topK, apiKey) {
  const data = loadEmbeddings();
  if (!data || !data.entries?.length) return null;

  // Embed the query
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: query }),
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  const queryEmbedding = result.data[0].embedding;

  // Score all entries by cosine similarity
  const scored = data.entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    category: entry.category,
    content: entry.content,
    tags: entry.tags,
    score: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  // Sort by score, return top-K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(({ embedding, ...rest }) => rest);
}

// ─── Tag-based fallback retrieval ───
function retrieveByTags(query, topK) {
  const data = loadEmbeddings();
  // Use entries from embeddings file, or return empty if not available
  const entries = data?.entries || [];
  if (entries.length === 0) return [];

  // Extract keywords from query (lowercase, split on non-alpha)
  const keywords = query.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);

  const scored = entries.map((entry) => {
    let score = 0;
    const entryText = `${entry.title} ${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
    for (const kw of keywords) {
      // Tag match (high weight)
      if (entry.tags.includes(kw)) score += 3;
      // Content match (medium weight)
      if (entryText.includes(kw)) score += 1;
    }
    return {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      content: entry.content,
      tags: entry.tags,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((e) => e.score > 0).slice(0, topK);
}

// ─── Handler ───
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query, topK = 6 } = req.body;
  if (!query) return res.status(400).json({ error: "Missing query" });

  const apiKey = process.env.OPENAI_API_KEY;
  let method = "none";
  let entries = [];

  try {
    // Try embedding-based retrieval first
    if (apiKey && loadEmbeddings()) {
      entries = await retrieveByEmbedding(query, topK, apiKey);
      method = "embedding";
    }

    // Fallback to tag-based
    if (!entries || entries.length === 0) {
      entries = retrieveByTags(query, topK);
      method = entries.length > 0 ? "tag_fallback" : "none";
    }

    return res.status(200).json({
      method,
      query,
      count: entries.length,
      entries,
    });
  } catch (err) {
    // On embedding error, try tag fallback
    entries = retrieveByTags(query, topK);
    method = entries.length > 0 ? "tag_fallback_after_error" : "error";

    return res.status(200).json({
      method,
      query,
      count: entries.length,
      entries,
      error: err.message,
    });
  }
}

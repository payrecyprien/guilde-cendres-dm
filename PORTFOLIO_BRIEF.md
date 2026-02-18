# La Guilde des Cendres — AI-Powered RPG

**Portfolio project for Prompt Specialist position**
Live demo: https://guilde-cendres.vercel.app
Source code: https://github.com/payrecyprien/guilde-cendres-dm

---

## What is it?

A fully playable tile-based RPG where every narrative element is generated in real-time by AI. Quests, exploration zones, combat narration, NPC dialogue, equipment crafting, monster portraits, and dynamic in-game events are all produced on the fly — no pre-written content exists beyond the world's foundational lore database.

The game is built as a single-page React application with a retro 16-bit aesthetic. Players explore a guild hall, accept contracts from an AI-driven quest giver, venture into procedurally generated zones where an AI Dungeon Master agent shapes the experience in real-time, fight monsters with narrated turn-based combat, collect materials, and forge unique equipment at the armorer.

---

## Prompt Engineering Patterns

This project demonstrates **nine distinct prompt engineering patterns**, each solving a different generation challenge:

### 1. Structured Narrative Generation — Quest System (Claude Sonnet 4.5)
The quest system produces complete, lore-consistent contracts with a single API call. The prompt defines Commander Varek's personality, enforces JSON output, and injects player context (level, stats, quest history) to avoid repetition and adapt difficulty. Each quest includes narrative intro, objectives, location mapping, rewards, moral dilemmas, and enemy hints.

### 2. Procedural Level Design with Few-Shot Learning (Claude Sonnet 4.5)
Zone generation translates a quest into a playable tile grid (14×10 to 22×14, variable by difficulty) with valid pathfinding, 8 organic shape types (L, T, U, cave, zigzag, ring...), biome-appropriate theming, and strategically placed monsters. The prompt includes a **few-shot example** — a fully annotated 8×6 L-shaped grid with explicit annotations explaining *why* it's correct (shape carving, entry placement, monster positioning). This grounds the model's output and reduces structural validation failures.

### 3. Chain-of-Thought Reasoning — Quest Generation (Claude Sonnet 4.5)
Before generating a contract, the model is prompted to reason step-by-step in a `"reasoning"` field: which quest types the player hasn't seen, which locations are fresh, what difficulty fits their stats, what twist would be memorable. The reasoning is logged in the developer observatory but never shown to the player. The user message injects used types and locations to give the CoT material to work with.

### 4. AI Agent with Function Calling — Dungeon Master (Claude Sonnet 4.5)
The Dungeon Master is an autonomous agent that observes the game state during exploration and decides whether and how to intervene. It receives the full context (player stats, quest info, zone state, its own decision history) and chooses from **5 tools** via Anthropic's function calling API (`tool_choice: { type: "any" }`):
- `narrate_event` — atmospheric beats, warnings, discoveries
- `spawn_monster` — ambushes scaled to player level
- `offer_choice` — binary moral/tactical dilemmas with pre-encoded consequences
- `drop_supply` — mercy drops for struggling players
- `no_action` — deliberate restraint (logged with reasoning for developer analysis)

The agent fires on contextual triggers (first kill, half-cleared, player wounded, zone cleared). The prompt emphasizes pacing discipline — not every trigger should produce an event. Each decision is validated, logged, and visible in the developer observatory.

### 5. RAG — Lore-Grounded Generation (OpenAI text-embedding-3-small + Claude)
A 46-entry knowledge base covers Ashburg's NPCs, locations, factions, creatures, events, artifacts, and rumors (~4,000 tokens total — too large to inject in full). Before quest generation and DM calls, a **retrieval step** embeds the current game context, computes cosine similarity against pre-computed lore vectors, and injects only the top-K most relevant entries into the prompt.

Pipeline: query builder → embedding search → context injection → generation.
Fallback: tag-based keyword matching if embeddings fail, static world context if retrieval fails entirely. The game never breaks.

### 6. Real-Time Combat Narration (Claude Haiku 4.5)
Each combat turn is narrated by a fast model that receives the full battle state and produces visceral, varied descriptions. Haiku was chosen over Sonnet for speed (~1s vs ~3s) — deliberate model selection based on the latency-quality tradeoff appropriate to real-time gameplay.

### 7. Contextual NPC Dialogue (Claude Haiku 4.5)
NPCs generate unique greetings based on the player's state. The AI call fires in parallel with other operations (quest generation runs simultaneously with the greeting). A fixed fallback displays instantly and is seamlessly replaced when the AI responds — graceful degradation with zero additional latency.

### 8. AI-Driven Item Crafting (Claude Sonnet 4.5)
Players collect biome-specific ingredients from defeated monsters. The AI generates unique equipment from the ingredients — name, stats, and description in the NPC's voice. Stat bonuses are constrained proportionally to ingredient tier, preventing power creep while preserving creative freedom.

### 9. Visual Asset Generation (GPT Image 1)
Monster portraits are generated as pixel art in a consistent 16-bit SNES style. Portraits are pre-loaded asynchronously when a zone generates (not when combat starts), so they appear on both the exploration map and combat screen with no loading delay.

---

## Anti-Slop System

All narrative prompts share a STYLE block that bans common LLM clichés:
- Banned punctuation: em-dashes, semicolons, gratuitous ellipsis
- Banned phrases: "testament to", "dance of", "symphony of", "tapestry of", "sends shivers", "echoes through"
- Banned sentence starters: "As", "With", "Having", "In a", "The air"
- Enforced: short punchy sentences, active voice, concrete verbs

The validation layer (`aiValidation.js`) detects slop via regex patterns and flags violations in the developer observatory.

---

## Developer Observatory

A built-in developer panel (press T) provides full transparency into every AI interaction:

- **Chronological log** of all API calls with status, endpoint, model, duration, and token estimates
- **4 tabs per call:** Prompt (full system + user message), Response (raw output), Validation (issues/fixes/summary), Playground
- **Playground:** editable prompts, temperature slider (0.00–1.00), model switching (Sonnet/Haiku), live A/B comparison
- **Stats bar:** total calls, success/error/pending, validation pass/fix rate, average duration, total tokens
- **RAG visibility:** retrieval calls show the embedding method used, query sent, entries retrieved with scores
- **Agent visibility:** DM calls show the tool chosen, input parameters, and internal reasoning

This tool demonstrates the kind of observability a prompt specialist would build for a production pipeline — every prompt is inspectable, testable, and iterable without touching code.

---

## Technical Architecture

**Frontend:** React 18 + Vite, custom tile engine, camera scrolling with viewport clamping, fog of war with radial vision, CSS sprite animations, void rendering via neighbor analysis.

**Backend:** Eight Vercel serverless functions:
| Endpoint | Model | Purpose |
|---|---|---|
| `/api/chat` | Claude Sonnet 4.5 | Quest generation |
| `/api/questzone` | Claude Sonnet 4.5 | Zone generation (few-shot) |
| `/api/combat` | Claude Haiku 4.5 | Combat narration |
| `/api/npc-dialogue` | Claude Haiku 4.5 | NPC greetings |
| `/api/craft` | Claude Sonnet 4.5 | Item crafting |
| `/api/monster-image` | GPT Image 1 | Monster portraits |
| `/api/dungeon-master` | Claude Sonnet 4.5 | DM agent (function calling) |
| `/api/retrieve-lore` | text-embedding-3-small | RAG retrieval |

**AI Validation Layer:** Every AI response passes through a validator (`aiValidation.js`) that checks structural integrity, applies auto-fixes, detects AI slop, and produces a summary. Validators exist for quests, zones, combat narration, crafted items, and DM agent decisions.

**Cost per play session (~3 quests):** approximately $0.18
- Quest generation (with RAG retrieval): ~$0.025/quest × 3
- Zone generation: ~$0.02/zone × 3
- Combat narration: ~$0.002/turn × ~8 turns
- NPC dialogue: ~$0.001/call × ~6 calls
- Monster portraits: $0.005/image × ~8 monsters
- Item crafting: ~$0.02/craft × ~1
- DM agent (with RAG): ~$0.01/trigger × ~3 triggers
- Lore retrieval: ~$0.0001/query × ~6 queries

---

## Key Design Decisions

**Agent where decisions matter, pipeline where they don't.** The DM agent uses function calling because it makes real choices that change gameplay. Quest and zone generation follow a deterministic pipeline because the sequence is fixed. This distinction — knowing when agentic patterns add value — is deliberate.

**RAG where context exceeds budget.** With 46 lore entries totaling ~4,000 tokens, full injection would bloat every prompt. Retrieval ensures each generation receives only the 4–6 most relevant entries, keeping prompts focused and costs controlled. The fallback chain (embeddings → tag matching → static context) ensures the game never breaks.

**Few-shot where structure matters.** Zone generation includes an annotated grid example because spatial layout is hard to specify in prose alone. The example teaches by showing, not telling — and the validation pass rate reflects the improvement.

**CoT where decisions compound.** Quest generation uses explicit reasoning so the model considers player history before choosing quest type, location, and difficulty. The reasoning is logged for developer analysis but hidden from the player.

**Graceful degradation everywhere.** Every AI call has a hardcoded fallback. If Sonnet is slow, the player sees a loading animation with in-character text. If image generation fails, an emoji sprite appears. If RAG retrieval fails, static lore is injected. The game is always playable.

**Model selection by constraint.** Sonnet for quality-critical tasks (quests, zones, crafting, DM decisions). Haiku for speed-critical tasks (combat narration, NPC greetings). GPT Image 1 for visual assets. text-embedding-3-small for vector search.

---

## What This Demonstrates

For a Prompt Specialist role in a game studio, this project shows:

1. **Agent design with function calling** — An autonomous DM that observes context and chooses tools, with validation and observability
2. **RAG pipeline** — Embedding-based retrieval from a lore database, with fallback chain and cost control
3. **Reasoning strategies** — Chain-of-thought for quest design decisions, few-shot learning for spatial generation
4. **Multi-model orchestration** — Four models (Sonnet, Haiku, GPT Image 1, text-embedding-3-small) chosen by constraint
5. **Prompt observability** — Developer panel with full prompt/response/validation inspection and live playground
6. **Production-grade resilience** — Fallbacks, auto-fixes, graceful degradation at every layer
7. **Anti-slop engineering** — Systematic detection and prevention of LLM clichés across all narrative output
8. **Cost-aware design** — Token budgeting, model selection, and retrieval scope tuned for ~$0.18/session

---

*Built by Cyprien Payre · React + Vite · Claude Sonnet & Haiku · GPT Image 1 · OpenAI Embeddings · Deployed on Vercel*

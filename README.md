# ⚔️ La Guilde des Cendres

**AI-powered tile-based RPG | Prompt Specialist portfolio project**

🔗 [**Live Demo**](https://guilde-cendres.vercel.app) · 📄 [**Portfolio Brief**](PORTFOLIO_BRIEF.md)

> Press **T** in-game to open the AI Prompt Observatory (developer panel)

---

## Concept

A fully playable browser RPG where the player is a mercenary of the Ash Guild. The guild hall serves as a hub for accepting contracts and gearing up. Quest zones, monsters, NPC dialogue, equipment, and in-game events are all generated dynamically by AI. Nothing is pre-written.

The project demonstrates **complete game orchestration by LLM**: an autonomous Dungeon Master agent, RAG-powered lore retrieval, procedural level design, real-time combat narration, and AI-driven crafting, all within a functional gameplay loop.

## What it demonstrates

- **AI Agent with function calling**: a Dungeon Master that observes game state and chooses from 5 tools in real-time
- **RAG pipeline**: 46-entry lore knowledge base with embedding search (cosine similarity, top-k injection)
- **Few-shot learning**: annotated grid example for procedural zone generation
- **Chain-of-thought**: explicit step-by-step reasoning in quest generation (logged, not shown to player)
- **Multi-model orchestration**: Claude Sonnet, Haiku, GPT Image 1, and OpenAI Embeddings, each chosen by constraint
- **Anti-slop system**: banned phrases, enforced style, regex validation on all narrative output
- **Developer observatory**: full prompt/response/validation inspection with live playground and A/B testing

## Architecture

| Endpoint | Model | Purpose |
|---|---|---|
| `/api/chat` | Claude Sonnet 4.5 | Quest generation (CoT) |
| `/api/questzone` | Claude Sonnet 4.5 | Zone generation (few-shot) |
| `/api/dungeon-master` | Claude Sonnet 4.5 | DM agent (function calling) |
| `/api/retrieve-lore` | text-embedding-3-small | RAG retrieval |
| `/api/combat` | Claude Haiku 4.5 | Combat narration |
| `/api/npc-dialogue` | Claude Haiku 4.5 | NPC greetings |
| `/api/craft` | Claude Sonnet 4.5 | Item crafting |
| `/api/monster-image` | GPT Image 1 | Monster portraits |

Cost per session (~3 quests): ~$0.18

## Stack

React 18 · Vite · Vercel Serverless · Claude Sonnet & Haiku (Anthropic API) · GPT Image 1 · OpenAI Embeddings

## Run locally

```bash
git clone https://github.com/payrecyprien/guilde-cendres-dm.git
cd guilde-cendres-dm
npm install
echo "ANTHROPIC_API_KEY=sk-ant-xxxxx" > .env
echo "OPENAI_API_KEY=sk-xxxxx" >> .env
npm run dev
```

## Controls

WASD / ZQSD / Arrows: move · E / Space: interact · J: journal · T: dev panel · ESC: close

---

*[Cyprien Payré](https://github.com/payrecyprien) · Prompt Engineering × Game Design*

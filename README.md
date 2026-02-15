# ⚔️ Guilde des Cendres

**RPG tile-based à génération procédurale par IA**

🔗 [**Démo live**](https://guilde-cendres.vercel.app) · 🏰 [**Écosystème Cendrebourg**](https://cendrebourg-landing.vercel.app)

---

## Concept

Un mini-RPG jouable dans le navigateur où le joueur incarne un mercenaire de la Guilde des Cendres. La guilde sert de hub — on y prend des contrats et on s'équipe. Les zones de quête, les monstres et les dialogues sont générés dynamiquement par IA.

Le projet démontre l'**orchestration complète d'un jeu par LLM** : génération de contenu, dialogue en temps réel, résolution de combat, et progression — le tout dans une boucle de gameplay fonctionnelle.

## État actuel

🟢 **Session 1** — Hub de guilde jouable (déplacement, PNJs, dialogues, HUD)
🔲 Session 2 — Intégration IA guilde (quêtes générées, craft)
🔲 Session 3 — Zones de quête (maps générées, monstres)
🔲 Session 4 — Combat tour par tour
🔲 Session 5 — Boucle complète

## Stack

React 18 · Vite · Vercel Serverless · Claude (Anthropic API)

## Lancer en local

```bash
git clone https://github.com/payrecyprien/guilde-cendres.git
cd guilde-cendres
npm install
echo "ANTHROPIC_API_KEY=sk-ant-xxxxx" > .env
npm run dev
```

## Contrôles

ZQSD / Flèches : se déplacer · E / Espace : interagir · ESC : fermer

## Écosystème Cendrebourg

Pipeline interconnecté : 🗺️ [Forge](https://forge-cendrebourg.vercel.app) → 📖 [Bestiaire](https://bestiaire-cendrebourg.vercel.app) → ⚔️ [Griffon Noir](https://griffon-noir.vercel.app) → 🎮 **Guilde des Cendres**

---

*[Cyprien Payré](https://github.com/payrecyprien) — Prompt Engineering × Game Design*

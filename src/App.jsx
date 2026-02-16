import { useState, useEffect, useCallback, useRef } from "react";
import {
  TILE_SIZE, WALKABLE, DIRECTIONS, KEY_MAP, INTERACT_KEYS,
  SCENE, DEFAULT_PLAYER, T,
} from "./data/constants";
import { GUILD_MAP, GUILD_START, NPCS } from "./data/guild";
import { ZT, ZONE_WALKABLE, getBiomeStyle } from "./data/zones";
import {
  QUEST_SYSTEM_PROMPT, buildQuestUserMessage, ARMORER_ITEMS,
  CRAFT_SYSTEM_PROMPT, buildCraftUserMessage,
  VAREK_DIALOGUE_PROMPT, buildVarekDialogueMessage,
  IRONHAMMER_DIALOGUE_PROMPT, buildIronhammerDialogueMessage,
} from "./data/prompts";
import { INGREDIENTS, rollDrop, MAX_CRAFTED_SLOTS } from "./data/crafting";
import { generateQuest, generateQuestZone, craftItem, getNPCDialogue, generateMonsterPortrait } from "./utils/api";
import useDialogue from "./hooks/useDialogue";
import useCombat from "./hooks/useCombat";
import useKeyboard from "./hooks/useKeyboard";
import TitleScene from "./scenes/TitleScene";
import GuildScene from "./scenes/GuildScene";
import QuestScene from "./scenes/QuestScene";
import CombatScene from "./scenes/CombatScene";
import PlayerSprite from "./components/PlayerSprite";
import DialogueBox from "./components/DialogueBox";
import JournalPanel from "./components/JournalPanel";
import DevPanel from "./components/DevPanel";
import HUD from "./components/HUD";

const GUILD_W = GUILD_MAP[0].length;
const GUILD_H = GUILD_MAP.length;

// Viewport size (what the player sees) — fixed regardless of zone size
const VIEWPORT_W = 14;
const VIEWPORT_H = 10;

export default function App() {
  // ─── ALL STATE IN COMPONENT ───
  const [scene, setScene] = useState(SCENE.TITLE);
  const [player, setPlayer] = useState({ ...DEFAULT_PLAYER });
  const [playerPos, setPlayerPos] = useState({ ...GUILD_START });
  const [facing, setFacing] = useState("up");
  const [activeQuest, setActiveQuest] = useState(null);
  const [questHistory, setQuestHistory] = useState([]);
  const [pendingQuest, setPendingQuest] = useState(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [lastQuestResult, setLastQuestResult] = useState(null); // tracks return context

  const [zoneData, setZoneData] = useState(null);
  const [zoneMonsters, setZoneMonsters] = useState([]);
  const [zoneBiome, setZoneBiome] = useState(null);
  const [monsterPortraits, setMonsterPortraits] = useState({}); // { "monsterName": "url" }

  const [highlightedNPC, setHighlightedNPC] = useState(null);
  const [highlightedMonster, setHighlightedMonster] = useState(null);
  const [showHint, setShowHint] = useState(null);

  const gameRef = useRef(null);
  const isGenerating = useRef(false);
  const combatTargetRef = useRef(null);

  // ─── DERIVED ───
  const objectiveUnlocked = !!activeQuest && zoneMonsters.length === 0;

  // ─── HOOKS (isolated, no cross-deps) ───
  const dialogue = useDialogue();
  const combat = useCombat();
  const keyboardRef = useKeyboard();

  // ─── HELPERS ───
  const getNPCAt = useCallback(
    (x, y) => scene === SCENE.GUILD ? NPCS.find((n) => n.x === x && n.y === y) : null,
    [scene]
  );

  const getMonsterAt = useCallback(
    (x, y) => scene === SCENE.QUEST ? zoneMonsters.find((m) => m.x === x && m.y === y) : null,
    [scene, zoneMonsters]
  );

  const isWalkable = useCallback((x, y) => {
    if (scene === SCENE.GUILD) {
      const tile = GUILD_MAP[y]?.[x];
      return tile !== undefined && WALKABLE.has(tile) && !NPCS.find((n) => n.x === x && n.y === y);
    } else if (zoneData) {
      const tile = zoneData.grid[y]?.[x];
      return tile !== undefined && ZONE_WALKABLE.has(tile) && !zoneMonsters.find((m) => m.x === x && m.y === y);
    }
    return false;
  }, [scene, zoneData, zoneMonsters]);

  const getFacingTile = (pos, dir) => {
    const [dx, dy] = DIRECTIONS[dir];
    return { x: pos.x + dx, y: pos.y + dy };
  };

  // ─── CONTEXTUAL NPC DIALOGUE (fixed fallbacks) ───
  const getVarekFallback = useCallback(() => {
    if (lastQuestResult === "victory") return "Good, you're back in one piece.";
    if (lastQuestResult === "defeat") return "Back already? Dust off and try again.";
    if (questHistory.length > 0) return "Ready for another run?";
    return "Welcome to the Ash Guild, mercenary.";
  }, [lastQuestResult, questHistory.length]);

  const getIronhammerFallback = useCallback(() => {
    if (player.hp < player.maxHp * 0.4) return "*eyes your wounds* You need a potion first.";
    if (player.ingredients?.length >= 2) return "*eyes the materials* Looks like you've got something for me.";
    return "*strikes the anvil* What do you need?";
  }, [player.hp, player.maxHp, player.ingredients]);

  // ═══════════════════════════════════════════
  // GUILD INTERACTIONS
  // ═══════════════════════════════════════════

  const talkToVarek = useCallback(async () => {
    if (activeQuest) {
      dialogue.open([{
        type: "text", speaker: "Commander Varek",
        text: `You already have a contract: "${activeQuest.title}". Finish it first.`,
      }]);
      return;
    }

    const questResult = lastQuestResult;
    setLastQuestResult(null);

    // Show fallback greeting + loading for quest gen
    dialogue.open([
      { type: "text", speaker: "Commander Varek", text: getVarekFallback() },
      { type: "loading", speaker: "Commander Varek", text: "Varek checks the contract board..." },
    ]);

    if (isGenerating.current) return;
    isGenerating.current = true;

    // Fire AI greeting + quest gen in parallel
    let aiGreeting = null;
    const greetingPromise = getNPCDialogue(
      VAREK_DIALOGUE_PROMPT,
      buildVarekDialogueMessage({
        level: player.level, hp: player.hp, maxHp: player.maxHp,
        gold: player.gold, lastResult: questResult, questCount: questHistory.length,
      })
    ).then((text) => { aiGreeting = text; return text; });

    const questPromise = generateQuest(
      QUEST_SYSTEM_PROMPT, buildQuestUserMessage(player, questHistory)
    );

    // Replace greeting as soon as AI responds (while quest still loading)
    greetingPromise.then((aiText) => {
      if (aiText) {
        dialogue.updateStep(0, { type: "text", speaker: "Commander Varek", text: aiText });
      }
    }).catch(() => {});

    try {
      const quest = await questPromise;
      setPendingQuest(quest);
      const greetingStep = {
        type: "text", speaker: "Commander Varek",
        text: aiGreeting || getVarekFallback(),
      };
      dialogue.replaceSteps([
        greetingStep,
        { type: "text", speaker: "Commander Varek", text: quest.intro || "I've got a contract for you." },
        {
          type: "choice", speaker: "Commander Varek",
          text: "Do you take the contract?", questDetail: quest,
          choices: [
            { label: "✅ Accept contract", action: "accept_quest", style: "choice-accept" },
            { label: "❌ Decline", action: "decline_quest", style: "choice-decline" },
          ],
        },
      ]);
    } catch (err) {
      console.error("Quest gen failed:", err);
      dialogue.replaceSteps([{
        type: "text", speaker: "Commander Varek",
        text: `[Error] ${err.message || err}`,
      }]);
    }
    isGenerating.current = false;
  }, [activeQuest, player, questHistory, lastQuestResult, dialogue, getVarekFallback]);

  const talkToArmorer = useCallback(() => {
    const choices = [];

    // Shop items
    const available = ARMORER_ITEMS.filter((item) =>
      item.id === "health_potion" || !player.inventory.includes(item.id)
    );
    available.slice(0, 3).forEach((item) => {
      choices.push({
        label: `${item.name} — ${item.cost} gold (${item.stat === "hp" ? `+${item.bonus} HP` : `+${item.bonus} ${item.stat.toUpperCase()}`})`,
        action: `buy_${item.id}`,
        style: player.gold >= item.cost ? "choice-accept" : "choice-disabled",
      });
    });

    // Craft option
    if (player.ingredients.length >= 2 && player.craftedGear.length < MAX_CRAFTED_SLOTS) {
      const ingIcons = player.ingredients.slice(0, 4).map(id => INGREDIENTS[id]?.icon || "?").join("");
      choices.push({
        label: `🔨 Forge (${player.ingredients.length} materials: ${ingIcons})`,
        action: "craft_start",
        style: "choice-accept",
      });
    } else if (player.ingredients.length > 0 && player.ingredients.length < 2) {
      choices.push({
        label: `🔨 Forge (need 2 materials, have ${player.ingredients.length})`,
        action: "noop",
        style: "choice-disabled",
      });
    }

    choices.push({ label: "Nothing for now", action: "leave_shop", style: "choice-decline" });

    const matText = player.ingredients.length > 0
      ? ` Materials: ${player.ingredients.map(id => INGREDIENTS[id]?.icon || "?").join(" ")}`
      : "";

    dialogue.open([
      { type: "text", speaker: "Ironhammer", text: getIronhammerFallback() },
      { type: "choice", speaker: "Ironhammer", text: `You have ${player.gold} gold.${matText}`, choices },
    ]);

    // Fire AI greeting async — replace step 0 when ready
    getNPCDialogue(
      IRONHAMMER_DIALOGUE_PROMPT,
      buildIronhammerDialogueMessage({
        level: player.level, hp: player.hp, maxHp: player.maxHp,
        ingredients: player.ingredients.length, gearCount: player.craftedGear.length,
        inventoryCount: player.inventory.length,
      })
    ).then((aiText) => {
      if (aiText) dialogue.updateStep(0, { type: "text", speaker: "Ironhammer", text: aiText });
    }).catch(() => {});
  }, [player, dialogue, getIronhammerFallback]);

  const interactDoor = useCallback(async () => {
    if (!activeQuest) {
      dialogue.open([{
        type: "text", speaker: "Guild Door", speakerColor: "#8b7355",
        text: "Accept a contract from Commander Varek before heading out.",
      }]);
      return;
    }

    dialogue.open([{
      type: "loading", speaker: "— System —", speakerColor: "#5a4a35",
      text: `Generating zone: ${activeQuest.location_name || activeQuest.location}...`,
    }]);

    if (isGenerating.current) return;
    isGenerating.current = true;

    try {
      const zone = await generateQuestZone(activeQuest);
      if (!zone.grid) throw new Error("No grid");

      const biome = getBiomeStyle(activeQuest.location);
      setZoneData(zone);
      setZoneMonsters(zone.monsters || []);
      setZoneBiome(biome);

      const gridH = zone.grid.length;
      const gridW = zone.grid[0]?.length || 14;
      let entryPos = { x: Math.floor(gridW / 2), y: gridH - 2 };
      for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < zone.grid[y].length; x++) {
          if (zone.grid[y][x] === 3) { entryPos = { x, y: y - 1 }; break; }
        }
      }
      if (!zone.grid[entryPos.y] || !ZONE_WALKABLE.has(zone.grid[entryPos.y][entryPos.x])) {
        entryPos = { x: Math.floor(gridW / 2), y: gridH - 2 };
      }

      setPlayerPos(entryPos);
      setFacing("up");
      setScene(SCENE.QUEST);
      dialogue.close();

      // Pre-generate monster portraits (async, non-blocking)
      setMonsterPortraits({});
      (zone.monsters || []).forEach((m) => {
        generateMonsterPortrait(m.name, m.description, activeQuest.location)
          .then((url) => {
            if (url) setMonsterPortraits((prev) => ({ ...prev, [m.name]: url }));
          })
          .catch(() => {});
      });

      setTimeout(() => {
        dialogue.open([{
          type: "text", speaker: biome.name, speakerColor: "#6fa0e0",
          text: zone.ambiance || "You arrive at the quest zone.",
        }]);
      }, 200);
    } catch (err) {
      console.error("Zone gen failed:", err);
      dialogue.replaceSteps([{
        type: "text", speaker: "— System —", speakerColor: "#c0392b",
        text: `[Zone error] ${err.message || err}`,
      }]);
    }
    isGenerating.current = false;
  }, [activeQuest, dialogue]);

  const interactChest = useCallback(() => {
    const lines = [];
    if (player.inventory.length > 0) {
      lines.push(`Shop gear: ${player.inventory.map(id => ARMORER_ITEMS.find(i => i.id === id)?.name || id).join(", ")}`);
    }
    if (player.craftedGear.length > 0) {
      lines.push(`Forged: ${player.craftedGear.map(g => `${g.name} (+${g.bonus} ${g.stat.toUpperCase()})`).join(", ")}`);
    }
    if (player.ingredients.length > 0) {
      lines.push(`Materials: ${player.ingredients.map(id => `${INGREDIENTS[id]?.icon || "?"} ${INGREDIENTS[id]?.name || id}`).join(", ")}`);
    }
    if ((player.potions || 0) > 0) {
      lines.push(`Potions: ${player.potions}`);
    }
    const text = lines.length > 0 ? lines.join(" · ") : "The chest is empty.";

    // Offer to drink potion if hurt and has stock
    if ((player.potions || 0) > 0 && player.hp < player.maxHp) {
      dialogue.open([
        { type: "text", speaker: "Chest", speakerColor: "#8b7355", text },
        {
          type: "choice", speaker: "Chest", speakerColor: "#8b7355",
          text: `HP: ${player.hp}/${player.maxHp}`,
          choices: [
            { label: `🧪 Drink Potion (+30 HP) — ${player.potions} left`, action: "use_potion", style: "choice-accept" },
            { label: "Close", action: "cancel", style: "choice-decline" },
          ],
        },
      ]);
    } else {
      dialogue.open([{ type: "text", speaker: "Chest", speakerColor: "#8b7355", text }]);
    }
  }, [player.inventory, player.craftedGear, player.ingredients, player.potions, player.hp, player.maxHp, dialogue]);

  // ═══════════════════════════════════════════
  // QUEST ZONE INTERACTIONS
  // ═══════════════════════════════════════════

  const interactZoneEntry = useCallback(() => {
    dialogue.open([{
      type: "choice", speaker: "Return Portal", speakerColor: "#d4a856",
      text: "Return to the guild? (Quest will be abandoned if not completed)",
      choices: [
        { label: "✅ Return to guild", action: "return_guild", style: "choice-accept" },
        { label: "❌ Continue", action: "stay_zone", style: "choice-decline" },
      ],
    }]);
  }, [dialogue]);

  const interactObjective = useCallback(() => {
    if (zoneMonsters.length > 0) {
      dialogue.open([{
        type: "text", speaker: "— Objective —", speakerColor: "#8b7355",
        text: `🔒 Eliminate all creatures in the zone before completing the objective. (${zoneMonsters.length} remaining${zoneMonsters.length > 1 ? "s" : ""})`,
      }]);
      return;
    }
    dialogue.open([
      {
        type: "text", speaker: "— Objective —", speakerColor: "#ffd700",
        text: `Quest "${activeQuest?.title}" complete!`,
      },
      {
        type: "choice", speaker: "— System —", speakerColor: "#5a4a35",
        text: "Return to the guild for your reward?",
        choices: [
          { label: "✅ Return to guild", action: "complete_and_return", style: "choice-accept" },
        ],
      },
    ]);
  }, [activeQuest, zoneMonsters.length, dialogue]);

  const encounterMonster = useCallback((monster) => {
    combatTargetRef.current = monster;
    const preloadedPortrait = monsterPortraits[monster.name] || null;
    combat.startCombat(monster, zoneBiome?.name, preloadedPortrait);
    setScene(SCENE.COMBAT);
  }, [combat, zoneBiome, monsterPortraits]);

  // ═══════════════════════════════════════════
  // SCENE TRANSITIONS
  // ═══════════════════════════════════════════

  const returnToGuild = useCallback((healPlayer = false) => {
    setScene(SCENE.GUILD);
    setPlayerPos({ ...GUILD_START });
    setFacing("up");
    setZoneData(null);
    setZoneMonsters([]);
    dialogue.close();
    if (healPlayer) {
      setPlayer((prev) => ({ ...prev, hp: Math.max(20, Math.floor(prev.maxHp / 2)) }));
    }
  }, [dialogue]);

  // ═══════════════════════════════════════════
  // COMBAT HANDLERS
  // ═══════════════════════════════════════════

  const handleCombatAction = useCallback(async (action) => {
    let effectivePlayer = { ...player };

    if (action === "potion") {
      if ((player.potions || 0) <= 0) return;
      if (player.hp >= player.maxHp) return;
      effectivePlayer.hp = Math.min(player.maxHp, player.hp + 30);
      setPlayer((prev) => ({
        ...prev,
        hp: Math.min(prev.maxHp, prev.hp + 30),
        potions: (prev.potions || 0) - 1,
      }));
      const result = await combat.executeAction("defend", effectivePlayer, zoneBiome?.name);
      if (result) {
        setPlayer((prev) => ({ ...prev, hp: result.newPlayerHp }));
      }
      return;
    }

    const result = await combat.executeAction(action, effectivePlayer, zoneBiome?.name);
    if (result) {
      setPlayer((prev) => ({ ...prev, hp: result.newPlayerHp }));
    }
  }, [combat, player, zoneBiome]);

  const handleCombatEnd = useCallback(() => {
    const target = combatTargetRef.current;

    if (combat.phase === "victory" && target) {
      setZoneMonsters((prev) => prev.filter((m) => !(m.x === target.x && m.y === target.y)));

      // Loot: gold + xp
      if (combat.loot) {
        setPlayer((prev) => ({
          ...prev,
          gold: prev.gold + combat.loot.gold,
          xp: prev.xp + combat.loot.xp,
        }));
      }

      // Ingredient drop
      const biomeKey = activeQuest?.location || "gloomhaze";
      const dropId = rollDrop(biomeKey);
      if (dropId && INGREDIENTS[dropId]) {
        const ing = INGREDIENTS[dropId];
        setPlayer((prev) => ({
          ...prev,
          ingredients: [...prev.ingredients, dropId],
        }));
        // Show drop after returning to quest
        setScene(SCENE.QUEST);
        setTimeout(() => {
          dialogue.open([{
            type: "text", speaker: "— Loot —", speakerColor: "#d4a856",
            text: `${ing.icon} Found: ${ing.name}! Bring it to Ironhammer to forge equipment.`,
          }]);
        }, 200);
      } else {
        setScene(SCENE.QUEST);
      }
    } else if (combat.phase === "defeat") {
      setActiveQuest(null);
      setLastQuestResult("defeat");
      returnToGuild(true);
    } else if (combat.phase === "fled") {
      setScene(SCENE.QUEST);
    }

    combatTargetRef.current = null;
  }, [combat.phase, combat.loot, activeQuest, dialogue, returnToGuild]);

  // ═══════════════════════════════════════════
  // CHOICE HANDLER
  // ═══════════════════════════════════════════

  const handleChoice = useCallback((action) => {
    if (action === "accept_quest" && pendingQuest) {
      setActiveQuest(pendingQuest);
      setPendingQuest(null);
      dialogue.close();
      dialogue.open([{
        type: "text", speaker: "Commander Varek",
        text: `Contract accepted: "${pendingQuest.title}". ${pendingQuest.enemy_hint ? `A word of advice: ${pendingQuest.enemy_hint}.` : ""} Gear up if needed, then head for the door.`,
      }]);
      return;
    }
    if (action === "decline_quest") {
      setPendingQuest(null);
      dialogue.close();
      return;
    }

    if (action.startsWith("buy_")) {
      const itemId = action.replace("buy_", "");
      const item = ARMORER_ITEMS.find((i) => i.id === itemId);
      if (!item || player.gold < item.cost) {
        dialogue.close();
        dialogue.open([{
          type: "text", speaker: "Ironhammer",
          text: "You don't have enough gold. Come back after a mission.",
        }]);
        return;
      }
      setPlayer((prev) => {
        const u = { ...prev, gold: prev.gold - item.cost };
        if (item.stat === "atk") u.atk = prev.atk + item.bonus;
        else if (item.stat === "def") u.def = prev.def + item.bonus;
        else if (item.id === "health_potion") u.potions = (prev.potions || 0) + 1;
        if (item.id !== "health_potion") u.inventory = [...prev.inventory, item.id];
        return u;
      });
      dialogue.close();
      const st = item.id === "health_potion" ? "Stocked" : `+${item.bonus} ${item.stat.toUpperCase()}`;
      dialogue.open([{
        type: "text", speaker: "Ironhammer", text: `*hands over ${item.name}* ${st}. Use it well.`,
      }]);
      return;
    }

    if (action === "return_guild") {
      returnToGuild();
      return;
    }
    if (action === "complete_and_return") {
      const reward = activeQuest;
      let didLevelUp = false;
      setPlayer((prev) => {
        const newXp = prev.xp + reward.reward_xp;
        const xpThreshold = prev.level * 30;
        const levelUp = newXp >= xpThreshold;
        didLevelUp = levelUp;
        // On quest complete: heal 30% HP + level up bonuses
        const newMaxHp = levelUp ? prev.maxHp + 10 : prev.maxHp;
        const healAmount = Math.floor(prev.maxHp * 0.3);
        return {
          ...prev,
          gold: prev.gold + reward.reward_gold,
          xp: levelUp ? newXp - xpThreshold : newXp,
          level: levelUp ? prev.level + 1 : prev.level,
          maxHp: newMaxHp,
          hp: Math.min(newMaxHp, prev.hp + healAmount + (levelUp ? 10 : 0)),
          atk: levelUp ? prev.atk + 1 : prev.atk,
          def: levelUp ? prev.def + 1 : prev.def,
        };
      });
      setQuestHistory((prev) => [...prev, activeQuest]);
      const rewardCopy = activeQuest;
      setActiveQuest(null);
      setLastQuestResult("victory");
      returnToGuild();
      setTimeout(() => {
        const steps = [{
          type: "text", speaker: "Commander Varek",
          text: `Contract fulfilled! +${rewardCopy.reward_gold} gold, +${rewardCopy.reward_xp} XP. Well done, mercenary.`,
        }];
        if (didLevelUp) {
          steps.push({
            type: "text", speaker: "— LEVEL UP! —", speakerColor: "#d4a856",
            text: `You are now level ${(player.level || 1) + 1}! +10 Max HP, +1 ATK, +1 DEF. Full heal.`,
          });
        }
        dialogue.open(steps);
      }, 200);
      return;
    }
    if (action === "death_return") {
      setActiveQuest(null);
      setLastQuestResult("defeat");
      returnToGuild(true);
      return;
    }

    if (action === "leave_shop" || action === "cancel" || action === "noop") {
      dialogue.close();
    }

    if (action === "use_potion") {
      if ((player.potions || 0) <= 0) { dialogue.close(); return; }
      setPlayer((prev) => ({
        ...prev,
        hp: Math.min(prev.maxHp, prev.hp + 30),
        potions: (prev.potions || 0) - 1,
      }));
      dialogue.close();
      dialogue.open([{
        type: "text", speaker: "— Heal —", speakerColor: "#6a9f4a",
        text: `You drink a potion. +30 HP.`,
      }]);
      return;
    }
    if (action === "stay_zone") {
      dialogue.close();
      setPlayerPos((prev) => ({ x: prev.x, y: prev.y - 1 }));
    }

    // ─── CRAFTING ───
    if (action === "craft_start") {
      if (player.ingredients.length < 2) { dialogue.close(); return; }

      // Take first 2 ingredients
      const used = player.ingredients.slice(0, 2);
      const usedData = used.map(id => INGREDIENTS[id]).filter(Boolean);
      const icons = usedData.map(i => `${i.icon} ${i.name}`).join(" + ");

      dialogue.close();
      dialogue.open([{
        type: "loading", speaker: "Ironhammer", speakerColor: "#8b6914",
        text: `*heats the forge* Working with ${icons}...`,
      }]);

      // Remove used ingredients
      setPlayer((prev) => {
        const remaining = [...prev.ingredients];
        remaining.splice(0, 2);
        return { ...prev, ingredients: remaining };
      });

      // Call AI
      (async () => {
        try {
          const item = await craftItem(
            CRAFT_SYSTEM_PROMPT,
            buildCraftUserMessage(usedData)
          );

          const craftedId = `crafted_${Date.now()}`;
          setPlayer((prev) => ({
            ...prev,
            [item.stat === "atk" ? "atk" : "def"]: prev[item.stat] + item.bonus,
            craftedGear: [...prev.craftedGear, { id: craftedId, ...item }],
          }));

          dialogue.replaceSteps([{
            type: "text", speaker: "Ironhammer", speakerColor: "#8b6914",
            text: `🔨 Forged: ${item.name} (+${item.bonus} ${item.stat.toUpperCase()})! ${item.description}`,
          }]);
        } catch (err) {
          dialogue.replaceSteps([{
            type: "text", speaker: "Ironhammer", speakerColor: "#c0392b",
            text: `*curses* Something went wrong at the forge. Your materials are lost. [${err.message}]`,
          }]);
        }
      })();
      return;
    }
  }, [pendingQuest, player, activeQuest, zoneMonsters, dialogue, returnToGuild]);

  // ═══════════════════════════════════════════
  // KEYBOARD — single ref, reads all state via closure
  // ═══════════════════════════════════════════

  // This runs every render, updating the ref with latest closure
  keyboardRef.current = (e) => {
    // ─── DEV PANEL TOGGLE ───
    if (e.key === "t" || e.key === "T") {
      e.preventDefault();
      setDevPanelOpen((prev) => !prev);
      return;
    }
    if (devPanelOpen) return; // block all other keys when dev panel is open

    // ─── TITLE SCREEN ───
    if (scene === SCENE.TITLE) {
      if (INTERACT_KEYS.has(e.key)) {
        e.preventDefault();
        setScene(SCENE.GUILD);
      }
      return;
    }

    // ─── JOURNAL TOGGLE ───
    if (e.key === "j" || e.key === "J") {
      if (scene === SCENE.GUILD || scene === SCENE.QUEST) {
        e.preventDefault();
        setJournalOpen((prev) => !prev);
        return;
      }
    }
    if (journalOpen) {
      if (e.key === "Escape" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        setJournalOpen(false);
      }
      return;
    }

    // ─── COMBAT KEYS ───
    if (scene === SCENE.COMBAT) {
      if (combat.phase === "choose") {
        if (e.key === "1") handleCombatAction("attack");
        else if (e.key === "2") handleCombatAction("defend");
        else if (e.key === "3") handleCombatAction("potion");
        else if (e.key === "4") handleCombatAction("flee");
      }
      if ((combat.phase === "victory" || combat.phase === "defeat" || combat.phase === "fled") &&
          (e.key === "e" || e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        handleCombatEnd();
      }
      return;
    }

    // ─── DIALOGUE KEYS ───
    if (dialogue.isOpen) {
      if (INTERACT_KEYS.has(e.key)) {
        e.preventDefault();
        dialogue.advance();
      }
      if (e.key === "Escape" && dialogue.currentStep?.type !== "loading") {
        dialogue.close();
      }
      if (dialogue.currentStep?.type === "choice" && dialogue.currentStep.choices) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= dialogue.currentStep.choices.length) {
          e.preventDefault();
          handleChoice(dialogue.currentStep.choices[num - 1].action);
        }
      }
      return;
    }

    // ─── MOVEMENT KEYS ───
    const dir = KEY_MAP[e.key];
    if (dir) {
      e.preventDefault();
      setFacing(dir);
      const [dx, dy] = DIRECTIONS[dir];
      setPlayerPos((prev) => {
        const nx = prev.x + dx;
        const ny = prev.y + dy;
        return isWalkable(nx, ny) ? { x: nx, y: ny } : prev;
      });
    }

    // ─── INTERACT KEY ───
    if (INTERACT_KEYS.has(e.key)) {
      e.preventDefault();

      const target = getFacingTile(playerPos, facing);

      if (scene === SCENE.GUILD) {
        const npc = getNPCAt(target.x, target.y);
        if (npc?.type === "quest") return talkToVarek();
        if (npc?.type === "armor") return talkToArmorer();
        const tile = GUILD_MAP[target.y]?.[target.x];
        if (tile === T.DOOR) return interactDoor();
        if (tile === T.CHEST) return interactChest();
      }

      if (scene === SCENE.QUEST && zoneData) {
        const monster = getMonsterAt(target.x, target.y);
        if (monster) return encounterMonster(monster);
        const tile = zoneData.grid[target.y]?.[target.x];
        if (tile === ZT.ENTRY) return interactZoneEntry();
        if (tile === ZT.OBJECTIVE) return interactObjective();
      }
    }
  };

  // ─── AUTO-INTERACT: step on objective/entry ───
  useEffect(() => {
    if (scene !== SCENE.QUEST || !zoneData || dialogue.isOpen) return;
    const tile = zoneData.grid[playerPos.y]?.[playerPos.x];
    if (tile === ZT.OBJECTIVE) interactObjective();
    else if (tile === ZT.ENTRY) interactZoneEntry();
  }, [scene, playerPos, zoneData, dialogue.isOpen, interactObjective, interactZoneEntry]);

  // ─── HINTS ───
  useEffect(() => {
    const target = getFacingTile(playerPos, facing);

    if (scene === SCENE.GUILD) {
      const npc = getNPCAt(target.x, target.y);
      const tile = GUILD_MAP[target.y]?.[target.x];
      setHighlightedNPC(npc || null);
      setHighlightedMonster(null);
      if (npc) setShowHint(`Talk to ${npc.name}`);
      else if (tile === T.DOOR) setShowHint(activeQuest ? "🚪 Head out" : "Exit");
      else if (tile === T.CHEST) setShowHint("Inventory");
      else setShowHint(null);
    } else if (scene === SCENE.QUEST && zoneData) {
      const monster = getMonsterAt(target.x, target.y);
      const tile = zoneData.grid[target.y]?.[target.x];
      setHighlightedNPC(null);
      setHighlightedMonster(monster || null);
      if (monster) setShowHint(`⚔ ${monster.name}`);
      else if (tile === ZT.ENTRY) setShowHint("🚪 Return");
      else if (tile === ZT.OBJECTIVE) setShowHint(zoneMonsters.length === 0 ? "⭐ Objective" : `🔒 Objective (${zoneMonsters.length} remaining)`);
      else setShowHint(null);
    }
  }, [scene, playerPos, facing, activeQuest, zoneData, zoneMonsters.length, getNPCAt, getMonsterAt]);

  // Auto-focus
  useEffect(() => { gameRef.current?.focus(); }, []);

  // ─── LAYOUT ───
  const zoneW = zoneData?.grid?.[0]?.length || VIEWPORT_W;
  const zoneH = zoneData?.grid?.length || VIEWPORT_H;

  const mapW = (scene === SCENE.GUILD ? GUILD_W : VIEWPORT_W) * TILE_SIZE;
  const mapH = (scene === SCENE.GUILD ? GUILD_H : VIEWPORT_H) * TILE_SIZE;

  // Camera offset: center player in viewport, clamp to map edges
  const cameraX = scene === SCENE.QUEST
    ? Math.max(0, Math.min(playerPos.x * TILE_SIZE - (VIEWPORT_W / 2 - 0.5) * TILE_SIZE, (zoneW - VIEWPORT_W) * TILE_SIZE))
    : 0;
  const cameraY = scene === SCENE.QUEST
    ? Math.max(0, Math.min(playerPos.y * TILE_SIZE - (VIEWPORT_H / 2 - 0.5) * TILE_SIZE, (zoneH - VIEWPORT_H) * TILE_SIZE))
    : 0;

  // ─── RENDER ───
  return (
    <div
      className="game-container"
      ref={gameRef}
      tabIndex={0}
      onClick={() => gameRef.current?.focus()}
    >
      {scene === SCENE.TITLE ? (
        <TitleScene onStart={() => setScene(SCENE.GUILD)} />
      ) : (
        <>
          <div className="game-header">
            <div className="game-title">
              {scene === SCENE.GUILD ? "ASH GUILD"
                : scene === SCENE.COMBAT ? "⚔ COMBAT"
                : (zoneBiome?.name || "QUEST ZONE").toUpperCase()}
            </div>
            <div className="game-subtitle">
              {scene === SCENE.GUILD ? "Mercenaries of Ashburg"
                : scene === SCENE.COMBAT ? combat.monster?.name || "Combat"
                : activeQuest?.title || "Exploration"}
            </div>
          </div>

          {scene === SCENE.COMBAT ? (
            <CombatScene
              combat={combat}
              player={player}
              onAction={handleCombatAction}
              onEnd={handleCombatEnd}
              zoneBiome={zoneBiome}
            />
          ) : (
            <div className="game-viewport" style={{ width: mapW, height: mapH, overflow: "hidden" }}>
              <div
                className="camera-container"
                style={{
                  width: scene === SCENE.QUEST ? zoneW * TILE_SIZE : mapW,
                  height: scene === SCENE.QUEST ? zoneH * TILE_SIZE : mapH,
                  transform: `translate(${-cameraX}px, ${-cameraY}px)`,
                  transition: "transform 0.15s ease-out",
                  position: "relative",
                }}
              >
                {scene === SCENE.GUILD && <GuildScene highlightedNPC={highlightedNPC} />}
                {scene === SCENE.QUEST && (
                  <QuestScene
                    zoneData={zoneData}
                    zoneBiome={zoneBiome}
                    monsters={zoneMonsters}
                    highlightedMonster={highlightedMonster}
                    playerPos={playerPos}
                    objectiveUnlocked={objectiveUnlocked}
                    monsterPortraits={monsterPortraits}
                  />
                )}

                <PlayerSprite pos={playerPos} facing={facing} />

                {showHint && !dialogue.isOpen && (
                  <div className="interact-hint" style={{
                    left: playerPos.x * TILE_SIZE + TILE_SIZE / 2,
                    top: playerPos.y * TILE_SIZE - 20,
                  }}>
                    [E] {showHint}
                  </div>
                )}
              </div>
              {/* End camera container — UI overlays below are fixed to viewport */}

              {dialogue.isOpen && (
                <DialogueBox
                  step={dialogue.currentStep}
                  onAdvance={dialogue.advance}
                  onChoice={handleChoice}
                  onClose={dialogue.close}
                />
              )}

              {journalOpen && (
                <JournalPanel
                  quests={questHistory}
                  onClose={() => setJournalOpen(false)}
                />
              )}
            </div>
          )}

          <HUD player={player} activeQuest={activeQuest} />
        </>
      )}

      {devPanelOpen && <DevPanel onClose={() => setDevPanelOpen(false)} />}
    </div>
  );
}

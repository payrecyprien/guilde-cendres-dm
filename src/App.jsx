import { useState, useEffect, useCallback, useRef } from "react";
import {
  TILE_SIZE, WALKABLE, DIRECTIONS, KEY_MAP, INTERACT_KEYS,
  SCENE, DEFAULT_PLAYER, T,
} from "./data/constants";
import { GUILD_MAP, GUILD_START, NPCS } from "./data/guild";
import { ZT, ZONE_WALKABLE, getBiomeStyle } from "./data/zones";
import { QUEST_SYSTEM_PROMPT, buildQuestUserMessage, ARMORER_ITEMS } from "./data/prompts";
import { generateQuest, generateQuestZone } from "./utils/api";
import useDialogue from "./hooks/useDialogue";
import useCombat from "./hooks/useCombat";
import useKeyboard from "./hooks/useKeyboard";
import GuildScene from "./scenes/GuildScene";
import QuestScene from "./scenes/QuestScene";
import CombatScene from "./scenes/CombatScene";
import PlayerSprite from "./components/PlayerSprite";
import DialogueBox from "./components/DialogueBox";
import HUD from "./components/HUD";

const GUILD_W = GUILD_MAP[0].length;
const GUILD_H = GUILD_MAP.length;
const ZONE_W = 14;
const ZONE_H = 10;

export default function App() {
  // ─── ALL STATE IN COMPONENT ───
  const [scene, setScene] = useState(SCENE.GUILD);
  const [player, setPlayer] = useState({ ...DEFAULT_PLAYER });
  const [playerPos, setPlayerPos] = useState({ ...GUILD_START });
  const [facing, setFacing] = useState("up");
  const [activeQuest, setActiveQuest] = useState(null);
  const [questHistory, setQuestHistory] = useState([]);
  const [pendingQuest, setPendingQuest] = useState(null);

  const [zoneData, setZoneData] = useState(null);
  const [zoneMonsters, setZoneMonsters] = useState([]);
  const [zoneBiome, setZoneBiome] = useState(null);

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

    dialogue.open([{
      type: "loading", speaker: "Commander Varek",
      text: "Varek checks the contract board...",
    }]);

    if (isGenerating.current) return;
    isGenerating.current = true;

    try {
      const quest = await generateQuest(
        QUEST_SYSTEM_PROMPT, buildQuestUserMessage(player, questHistory)
      );
      setPendingQuest(quest);
      dialogue.replaceSteps([
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
  }, [activeQuest, player, questHistory, dialogue]);

  const talkToArmorer = useCallback(() => {
    const available = ARMORER_ITEMS.filter((item) =>
      item.id === "health_potion" || !player.inventory.includes(item.id)
    );

    if (available.length === 0) {
      dialogue.open([{
        type: "text", speaker: "Ironhammer",
        text: "*looks at empty stock* You already have everything. Come back when I have new gear.",
      }]);
      return;
    }

    const choices = available.slice(0, 3).map((item) => ({
      label: `${item.name} — ${item.cost} gold (${item.stat === "hp" ? `+${item.bonus} HP` : `+${item.bonus} ${item.stat.toUpperCase()}`})`,
      action: `buy_${item.id}`,
      style: player.gold >= item.cost ? "choice-accept" : "choice-disabled",
    }));
    choices.push({ label: "Nothing for now", action: "leave_shop", style: "choice-decline" });

    dialogue.open([
      { type: "text", speaker: "Ironhammer", text: "*strikes the anvil* What do you need?" },
      { type: "choice", speaker: "Ironhammer", text: `You have ${player.gold} gold.`, choices },
    ]);
  }, [player, dialogue]);

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

      let entryPos = { x: 6, y: 8 };
      for (let y = 0; y < zone.grid.length; y++) {
        for (let x = 0; x < zone.grid[y].length; x++) {
          if (zone.grid[y][x] === 3) { entryPos = { x, y: y - 1 }; break; }
        }
      }
      if (!zone.grid[entryPos.y] || !ZONE_WALKABLE.has(zone.grid[entryPos.y][entryPos.x])) {
        entryPos = { x: 6, y: 8 };
      }

      setPlayerPos(entryPos);
      setFacing("up");
      setScene(SCENE.QUEST);
      dialogue.close();

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
    const invText = player.inventory.length > 0
      ? `Equipment: ${player.inventory.map(id => ARMORER_ITEMS.find(i => i.id === id)?.name || id).join(", ")}.`
      : "The chest is empty.";
    dialogue.open([{ type: "text", speaker: "Chest", speakerColor: "#8b7355", text: invText }]);
  }, [player.inventory, dialogue]);

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
    combat.startCombat(monster, zoneBiome?.name);
    setScene(SCENE.COMBAT);
  }, [combat, zoneBiome]);

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
      if (player.hp >= player.maxHp) return;
      effectivePlayer.hp = Math.min(player.maxHp, player.hp + 30);
      setPlayer((prev) => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + 30) }));
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
      if (combat.loot) {
        setPlayer((prev) => ({
          ...prev,
          gold: prev.gold + combat.loot.gold,
          xp: prev.xp + combat.loot.xp,
        }));
      }
      setScene(SCENE.QUEST);
    } else if (combat.phase === "defeat") {
      setActiveQuest(null);
      returnToGuild(true);
    } else if (combat.phase === "fled") {
      setScene(SCENE.QUEST);
    }

    combatTargetRef.current = null;
  }, [combat.phase, combat.loot, returnToGuild]);

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
        else if (item.stat === "hp") u.hp = Math.min(prev.maxHp, prev.hp + item.bonus);
        if (item.id !== "health_potion") u.inventory = [...prev.inventory, item.id];
        return u;
      });
      dialogue.close();
      const st = item.stat === "hp" ? `+${item.bonus} PV` : `+${item.bonus} ${item.stat.toUpperCase()}`;
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
      setPlayer((prev) => {
        const newXp = prev.xp + reward.reward_xp;
        const levelUp = newXp >= prev.level * 30;
        return {
          ...prev,
          gold: prev.gold + reward.reward_gold,
          xp: newXp,
          level: levelUp ? prev.level + 1 : prev.level,
          hp: levelUp ? prev.maxHp + 10 : prev.hp,
          maxHp: levelUp ? prev.maxHp + 10 : prev.maxHp,
        };
      });
      setQuestHistory((prev) => [...prev, activeQuest]);
      const rewardCopy = activeQuest;
      setActiveQuest(null);
      returnToGuild();
      setTimeout(() => {
        dialogue.open([{
          type: "text", speaker: "Commander Varek",
          text: `Contract fulfilled! +${rewardCopy.reward_gold} gold, +${rewardCopy.reward_xp} XP. Well done, mercenary.`,
        }]);
      }, 200);
      return;
    }
    if (action === "death_return") {
      setActiveQuest(null);
      returnToGuild(true);
      return;
    }

    if (action === "leave_shop" || action === "cancel") {
      dialogue.close();
    }
    if (action === "stay_zone") {
      dialogue.close();
      setPlayerPos((prev) => ({ x: prev.x, y: prev.y - 1 }));
    }
  }, [pendingQuest, player, activeQuest, zoneMonsters, dialogue, returnToGuild]);

  // ═══════════════════════════════════════════
  // KEYBOARD — single ref, reads all state via closure
  // ═══════════════════════════════════════════

  // This runs every render, updating the ref with latest closure
  keyboardRef.current = (e) => {
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
  const mapW = (scene === SCENE.GUILD ? GUILD_W : ZONE_W) * TILE_SIZE;
  const mapH = (scene === SCENE.GUILD ? GUILD_H : ZONE_H) * TILE_SIZE;

  // ─── RENDER ───
  return (
    <div
      className="game-container"
      ref={gameRef}
      tabIndex={0}
      onClick={() => gameRef.current?.focus()}
    >
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
        <div className="game-viewport" style={{ width: mapW, height: mapH }}>
          {scene === SCENE.GUILD && <GuildScene highlightedNPC={highlightedNPC} />}
          {scene === SCENE.QUEST && (
            <QuestScene
              zoneData={zoneData}
              zoneBiome={zoneBiome}
              monsters={zoneMonsters}
              highlightedMonster={highlightedMonster}
              playerPos={playerPos}
              objectiveUnlocked={objectiveUnlocked}
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

          {dialogue.isOpen && (
            <DialogueBox
              step={dialogue.currentStep}
              onAdvance={dialogue.advance}
              onChoice={handleChoice}
              onClose={dialogue.close}
            />
          )}
        </div>
      )}

      <HUD player={player} activeQuest={activeQuest} />
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TILE_SIZE, WALKABLE, DIRECTIONS, SCENE, DEFAULT_PLAYER, T,
} from "./data/constants";
import { GUILD_MAP, GUILD_START, NPCS } from "./data/guild";
import { ZT, ZONE_WALKABLE, getBiomeStyle } from "./data/zones";
import { QUEST_SYSTEM_PROMPT, buildQuestUserMessage, ARMORER_ITEMS } from "./data/prompts";
import { generateQuest, generateQuestZone } from "./utils/api";
import useDialogue from "./hooks/useDialogue";
import useMovement from "./hooks/useMovement";
import useCombat from "./hooks/useCombat";
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
  // ─── GLOBAL GAME STATE ───
  const [scene, setScene] = useState(SCENE.GUILD);
  const [player, setPlayer] = useState({ ...DEFAULT_PLAYER });
  const [activeQuest, setActiveQuest] = useState(null);
  const [questHistory, setQuestHistory] = useState([]);
  const [pendingQuest, setPendingQuest] = useState(null);

  // ─── QUEST ZONE STATE ───
  const [zoneData, setZoneData] = useState(null);
  const [zoneMonsters, setZoneMonsters] = useState([]);
  const [zoneBiome, setZoneBiome] = useState(null);

  // ─── HIGHLIGHT STATE ───
  const [highlightedNPC, setHighlightedNPC] = useState(null);
  const [highlightedMonster, setHighlightedMonster] = useState(null);
  const [showHint, setShowHint] = useState(null);

  const gameRef = useRef(null);
  const isGenerating = useRef(false);
  const combatTargetRef = useRef(null);

  // ─── DERIVED: is the objective reachable? ───
  const objectiveUnlocked = (() => {
    if (!activeQuest) return false;
    if (zoneMonsters.length > 0) return false;
    return true;
  })();

  // ─── HOOKS ───
  const dialogue = useDialogue();
  const combat = useCombat();
  const movement = useMovement({ initialPos: { ...GUILD_START }, initialFacing: "up" });

  // Helpers
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
      return tile !== undefined && WALKABLE.has(tile) && !getNPCAt(x, y);
    } else if (zoneData) {
      const tile = zoneData.grid[y]?.[x];
      return tile !== undefined && ZONE_WALKABLE.has(tile) && !getMonsterAt(x, y);
    }
    return false;
  }, [scene, zoneData, getNPCAt, getMonsterAt]);

  const getFacingTile = useCallback((pPos, dir) => {
    const [dx, dy] = DIRECTIONS[dir];
    return { x: pPos.x + dx, y: pPos.y + dy };
  }, []);

  // ═══════════════════════════════════════════
  // GUILD INTERACTIONS
  // ═══════════════════════════════════════════

  const talkToVarek = useCallback(async () => {
    if (activeQuest) {
      dialogue.open([{
        type: "text", speaker: "Commandant Varek",
        text: `Tu as déjà un contrat : "${activeQuest.title}". Finis-le d'abord.`,
      }]);
      return;
    }

    dialogue.open([{
      type: "loading", speaker: "Commandant Varek",
      text: "Varek consulte le tableau des contrats...",
    }]);

    if (isGenerating.current) return;
    isGenerating.current = true;

    try {
      const quest = await generateQuest(
        QUEST_SYSTEM_PROMPT, buildQuestUserMessage(player, questHistory)
      );
      setPendingQuest(quest);
      dialogue.replaceSteps([
        { type: "text", speaker: "Commandant Varek", text: quest.intro || "J'ai un contrat pour toi." },
        {
          type: "choice", speaker: "Commandant Varek",
          text: "Tu prends le contrat ?", questDetail: quest,
          choices: [
            { label: "✅ Accepter le contrat", action: "accept_quest", style: "choice-accept" },
            { label: "❌ Refuser", action: "decline_quest", style: "choice-decline" },
          ],
        },
      ]);
    } catch (err) {
      console.error("Quest gen failed:", err);
      dialogue.replaceSteps([{
        type: "text", speaker: "Commandant Varek",
        text: `[Erreur] ${err.message || err}`,
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
        type: "text", speaker: "Forge-Marteau",
        text: "*regarde son stock vide* T'as déjà tout. Reviens quand j'aurai du nouveau.",
      }]);
      return;
    }

    const choices = available.slice(0, 3).map((item) => ({
      label: `${item.name} — ${item.cost} or (${item.stat === "hp" ? `+${item.bonus} PV` : `+${item.bonus} ${item.stat.toUpperCase()}`})`,
      action: `buy_${item.id}`,
      style: player.gold >= item.cost ? "choice-accept" : "choice-disabled",
    }));
    choices.push({ label: "Rien pour l'instant", action: "leave_shop", style: "choice-decline" });

    dialogue.open([
      { type: "text", speaker: "Forge-Marteau", text: "*frappe l'enclume* Qu'est-ce qu'il te faut ?" },
      { type: "choice", speaker: "Forge-Marteau", text: `Tu as ${player.gold} pièces d'or.`, choices },
    ]);
  }, [player, dialogue]);

  const interactDoor = useCallback(async () => {
    if (!activeQuest) {
      dialogue.open([{
        type: "text", speaker: "Porte de la guilde", speakerColor: "#8b7355",
        text: "Accepte un contrat auprès du Commandant Varek avant de partir.",
      }]);
      return;
    }

    dialogue.open([{
      type: "loading", speaker: "— Système —", speakerColor: "#5a4a35",
      text: `Génération de la zone : ${activeQuest.location_name || activeQuest.location}...`,
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

      // Find entry position (1 tile above entry tile)
      let entryPos = { x: 6, y: 8 };
      for (let y = 0; y < zone.grid.length; y++) {
        for (let x = 0; x < zone.grid[y].length; x++) {
          if (zone.grid[y][x] === 3) { entryPos = { x, y: y - 1 }; break; }
        }
      }
      if (!zone.grid[entryPos.y] || !ZONE_WALKABLE.has(zone.grid[entryPos.y][entryPos.x])) {
        entryPos = { x: 6, y: 8 };
      }

      movement.resetPosition(entryPos, "up");
      setScene(SCENE.QUEST);
      dialogue.close();

      setTimeout(() => {
        dialogue.open([{
          type: "text", speaker: biome.name, speakerColor: "#6fa0e0",
          text: zone.ambiance || "Tu arrives dans la zone de quête.",
        }]);
      }, 200);
    } catch (err) {
      console.error("Zone gen failed:", err);
      dialogue.replaceSteps([{
        type: "text", speaker: "— Système —", speakerColor: "#c0392b",
        text: `[Erreur zone] ${err.message || err}`,
      }]);
    }
    isGenerating.current = false;
  }, [activeQuest, dialogue]);

  const interactChest = useCallback(() => {
    const invText = player.inventory.length > 0
      ? `Équipement : ${player.inventory.map(id => ARMORER_ITEMS.find(i => i.id === id)?.name || id).join(", ")}.`
      : "Le coffre est vide.";
    dialogue.open([{ type: "text", speaker: "Coffre", speakerColor: "#8b7355", text: invText }]);
  }, [player.inventory, dialogue]);

  // ═══════════════════════════════════════════
  // QUEST ZONE INTERACTIONS
  // ═══════════════════════════════════════════

  const interactZoneEntry = useCallback(() => {
    dialogue.open([{
      type: "choice", speaker: "Portail de retour", speakerColor: "#d4a856",
      text: "Rentrer à la guilde ? (La quête sera abandonnée si non complétée)",
      choices: [
        { label: "✅ Rentrer à la guilde", action: "return_guild", style: "choice-accept" },
        { label: "❌ Continuer", action: "cancel", style: "choice-decline" },
      ],
    }]);
  }, [dialogue]);

  const interactObjective = useCallback(() => {
    if (!objectiveUnlocked) {
      dialogue.open([{
        type: "text", speaker: "— Objectif —", speakerColor: "#8b7355",
        text: `🔒 Élimine toutes les créatures de la zone avant de compléter l'objectif. (${zoneMonsters.length} restant${zoneMonsters.length > 1 ? "s" : ""})`,
      }]);
      return;
    }
    dialogue.open([
      {
        type: "text", speaker: "— Objectif —", speakerColor: "#ffd700",
        text: `Quête "${activeQuest?.title}" accomplie !`,
      },
      {
        type: "choice", speaker: "— Système —", speakerColor: "#5a4a35",
        text: "Rentrer à la guilde pour ta récompense ?",
        choices: [
          { label: "✅ Retour à la guilde", action: "complete_and_return", style: "choice-accept" },
        ],
      },
    ]);
  }, [activeQuest, objectiveUnlocked, zoneMonsters.length, dialogue]);

  const encounterMonster = useCallback((monster) => {
    combatTargetRef.current = monster;
    combat.startCombat(monster, zoneBiome?.name);
    setScene(SCENE.COMBAT);
  }, [combat, zoneBiome]);

  // ═══════════════════════════════════════════
  // COMBAT HANDLERS
  // ═══════════════════════════════════════════

  const handleCombatAction = useCallback(async (action) => {
    let effectivePlayer = { ...player };

    if (action === "potion") {
      if (player.hp >= player.maxHp) return;
      // Heal 30 HP before combat resolution
      effectivePlayer.hp = Math.min(player.maxHp, player.hp + 30);
      setPlayer((prev) => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + 30) }));
      // Treated as defend (monster still attacks but reduced damage)
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
      // Remove monster from zone
      setZoneMonsters((prev) => prev.filter((m) => !(m.x === target.x && m.y === target.y)));
      // Give loot
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

  // ─── COMBAT KEYBOARD ───
  useEffect(() => {
    if (scene !== SCENE.COMBAT) return;

    const handler = (e) => {
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
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scene, combat.phase, handleCombatAction, handleCombatEnd]);

  // ═══════════════════════════════════════════
  // INTERACTION ROUTER
  // ═══════════════════════════════════════════

  const handleInteract = useCallback(() => {
    const target = getFacingTile(movement.pos, movement.facing);

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
  }, [scene, zoneData, getFacingTile, getNPCAt, getMonsterAt,
    talkToVarek, talkToArmorer, interactDoor, interactChest,
    encounterMonster, interactZoneEntry, interactObjective]);

  // ═══════════════════════════════════════════
  // SCENE TRANSITIONS
  // ═══════════════════════════════════════════

  const returnToGuild = useCallback((healPlayer = false) => {
    setScene(SCENE.GUILD);
    movement.resetPosition({ ...GUILD_START }, "up");
    setZoneData(null);
    setZoneMonsters([]);
    dialogue.close();
    if (healPlayer) {
      setPlayer((prev) => ({ ...prev, hp: Math.max(20, Math.floor(prev.maxHp / 2)) }));
    }
  }, [dialogue]);

  // ═══════════════════════════════════════════
  // CHOICE HANDLER
  // ═══════════════════════════════════════════

  const handleChoice = useCallback((action) => {
    // ─── Quest accept/decline ───
    if (action === "accept_quest" && pendingQuest) {
      setActiveQuest(pendingQuest);
      setPendingQuest(null);
      dialogue.close();
      dialogue.open([{
        type: "text", speaker: "Commandant Varek",
        text: `Contrat accepté : "${pendingQuest.title}". ${pendingQuest.enemy_hint ? `Un conseil : ${pendingQuest.enemy_hint}.` : ""} Équipe-toi si besoin, puis prends la porte.`,
      }]);
      return;
    }
    if (action === "decline_quest") {
      setPendingQuest(null);
      dialogue.close();
      return;
    }

    // ─── Shop ───
    if (action.startsWith("buy_")) {
      const itemId = action.replace("buy_", "");
      const item = ARMORER_ITEMS.find((i) => i.id === itemId);
      if (!item || player.gold < item.cost) {
        dialogue.close();
        dialogue.open([{
          type: "text", speaker: "Forge-Marteau",
          text: "T'as pas assez d'or. Reviens après une mission.",
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
        type: "text", speaker: "Forge-Marteau", text: `*tend ${item.name}* ${st}. Fais-en bon usage.`,
      }]);
      return;
    }

    // ─── Return / Complete ───
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
          type: "text", speaker: "Commandant Varek",
          text: `Contrat rempli ! +${rewardCopy.reward_gold} or, +${rewardCopy.reward_xp} XP. Bien joué, mercenaire.`,
        }]);
      }, 200);
      return;
    }
    if (action === "death_return") {
      setActiveQuest(null);
      returnToGuild(true);
      return;
    }

    // ─── Generic close ───
    if (action === "leave_shop" || action === "cancel") {
      dialogue.close();
    }
  }, [pendingQuest, player, activeQuest, zoneMonsters, dialogue, returnToGuild]);

  // ─── SYNC MOVEMENT CALLBACKS (ref-based, no circular deps) ───
  movement.updateCallbacks({
    isWalkable,
    onInteract: handleInteract,
    dialogueOpen: dialogue.isOpen,
    onDialogueAdvance: dialogue.advance,
    onDialogueClose: dialogue.close,
    dialogueStep: dialogue.currentStep,
    onChoice: handleChoice,
    disabled: scene === SCENE.COMBAT,
  });

  // ─── AUTO-INTERACT: step on objective/entry ───
  useEffect(() => {
    if (scene !== SCENE.QUEST || !zoneData || dialogue.isOpen) return;
    const tile = zoneData.grid[movement.pos.y]?.[movement.pos.x];
    if (tile === ZT.OBJECTIVE) interactObjective();
    else if (tile === ZT.ENTRY) interactZoneEntry();
  }, [scene, movement.pos, zoneData, dialogue.isOpen, interactObjective, interactZoneEntry]);

  // ─── HINTS ───
  useEffect(() => {
    const target = getFacingTile(movement.pos, movement.facing);

    if (scene === SCENE.GUILD) {
      const npc = getNPCAt(target.x, target.y);
      const tile = GUILD_MAP[target.y]?.[target.x];
      setHighlightedNPC(npc || null);
      setHighlightedMonster(null);
      if (npc) setShowHint(`Parler à ${npc.name}`);
      else if (tile === T.DOOR) setShowHint(activeQuest ? "🚪 Partir en mission" : "Sortir");
      else if (tile === T.CHEST) setShowHint("Inventaire");
      else setShowHint(null);
    } else if (scene === SCENE.QUEST && zoneData) {
      const monster = getMonsterAt(target.x, target.y);
      const tile = zoneData.grid[target.y]?.[target.x];
      setHighlightedNPC(null);
      setHighlightedMonster(monster || null);
      if (monster) setShowHint(`⚔ ${monster.name}`);
      else if (tile === ZT.ENTRY) setShowHint("🚪 Retour");
      else if (tile === ZT.OBJECTIVE) setShowHint(objectiveUnlocked ? "⭐ Objectif" : `🔒 Objectif (${zoneMonsters.length} restants)`);
      else setShowHint(null);
    }
  }, [scene, movement.pos, movement.facing, activeQuest, zoneData, objectiveUnlocked, zoneMonsters.length, getFacingTile, getNPCAt, getMonsterAt]);

  // Auto-focus
  useEffect(() => { gameRef.current?.focus(); }, []);

  // ─── DERIVED ───
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
          {scene === SCENE.GUILD ? "GUILDE DES CENDRES"
            : scene === SCENE.COMBAT ? "⚔ COMBAT"
            : (zoneBiome?.name || "ZONE DE QUÊTE").toUpperCase()}
        </div>
        <div className="game-subtitle">
          {scene === SCENE.GUILD ? "Mercenaires de Cendrebourg"
            : scene === SCENE.COMBAT ? combat.monster?.name || "Combat"
            : activeQuest?.title || "Exploration"}
        </div>
      </div>

      {/* COMBAT SCENE — full replacement */}
      {scene === SCENE.COMBAT ? (
        <CombatScene
          combat={combat}
          player={player}
          onAction={handleCombatAction}
          onEnd={handleCombatEnd}
          zoneBiome={zoneBiome}
        />
      ) : (
        /* EXPLORATION SCENES (guild + quest) */
        <div className="game-viewport" style={{ width: mapW, height: mapH }}>
          {scene === SCENE.GUILD && <GuildScene highlightedNPC={highlightedNPC} />}
          {scene === SCENE.QUEST && (
            <QuestScene
              zoneData={zoneData}
              zoneBiome={zoneBiome}
              monsters={zoneMonsters}
              highlightedMonster={highlightedMonster}
              playerPos={movement.pos}
              objectiveUnlocked={objectiveUnlocked}
            />
          )}

          <PlayerSprite pos={movement.pos} facing={movement.facing} />

          {showHint && !dialogue.isOpen && (
            <div className="interact-hint" style={{
              left: movement.pos.x * TILE_SIZE + TILE_SIZE / 2,
              top: movement.pos.y * TILE_SIZE - 20,
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

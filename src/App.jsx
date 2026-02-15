import { useState, useEffect, useCallback, useRef } from "react";
import {
  TILE_SIZE, WALKABLE, DIRECTIONS, KEY_MAP, INTERACT_KEYS,
  SCENE, DEFAULT_PLAYER, T,
} from "./data/constants";
import { GUILD_MAP, GUILD_START, NPCS } from "./data/guild";
import { QUEST_SYSTEM_PROMPT, buildQuestUserMessage, ARMORER_ITEMS } from "./data/prompts";
import { generateQuest } from "./utils/api";
import Tile from "./components/Tile";
import NPCSprite from "./components/NPCSprite";
import PlayerSprite from "./components/PlayerSprite";
import DialogueBox from "./components/DialogueBox";
import HUD from "./components/HUD";

const MAP_W = GUILD_MAP[0].length;
const MAP_H = GUILD_MAP.length;

export default function App() {
  // ─── GAME STATE ───
  const [scene, setScene] = useState(SCENE.GUILD);
  const [player, setPlayer] = useState({ ...DEFAULT_PLAYER });
  const [playerPos, setPlayerPos] = useState({ ...GUILD_START });
  const [facing, setFacing] = useState("up");
  const [activeQuest, setActiveQuest] = useState(null);
  const [questHistory, setQuestHistory] = useState([]);
  const [pendingQuest, setPendingQuest] = useState(null);

  // ─── DIALOGUE STATE (step-based) ───
  const [dialogueSteps, setDialogueSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightedNPC, setHighlightedNPC] = useState(null);
  const [showHint, setShowHint] = useState(null);

  const gameRef = useRef(null);
  const isGenerating = useRef(false);

  const currentStep = dialogueSteps[stepIndex] || null;
  const inDialogue = dialogueSteps.length > 0;

  // ─── HELPERS ───
  const getNPCAt = useCallback(
    (x, y) => NPCS.find((n) => n.x === x && n.y === y),
    []
  );

  const getFacingTile = useCallback(
    (pos, dir) => {
      const [dx, dy] = DIRECTIONS[dir];
      return { x: pos.x + dx, y: pos.y + dy };
    },
    []
  );

  const openDialogue = useCallback((steps) => {
    setDialogueSteps(steps);
    setStepIndex(0);
  }, []);

  const closeDialogue = useCallback(() => {
    setDialogueSteps([]);
    setStepIndex(0);
  }, []);

  // ─── VAREK: QUEST GENERATION ───
  const handleTalkToVarek = useCallback(async () => {
    // Already has a quest
    if (activeQuest) {
      openDialogue([
        {
          type: "text",
          speaker: "Commandant Varek",
          text: `Tu as déjà un contrat en cours : "${activeQuest.title}". Finis-le d'abord, mercenaire.`,
        },
      ]);
      return;
    }

    // Show loading, then generate
    openDialogue([
      {
        type: "loading",
        speaker: "Commandant Varek",
        text: "Varek consulte le tableau des contrats...",
      },
    ]);

    if (isGenerating.current) return;
    isGenerating.current = true;

    try {
      const quest = await generateQuest(
        QUEST_SYSTEM_PROMPT,
        buildQuestUserMessage(player, questHistory)
      );

      setPendingQuest(quest);

      setDialogueSteps([
        {
          type: "text",
          speaker: "Commandant Varek",
          text: quest.intro || "J'ai un contrat pour toi.",
        },
        {
          type: "choice",
          speaker: "Commandant Varek",
          text: "Tu prends le contrat ?",
          questDetail: quest,
          choices: [
            { label: "✅ Accepter le contrat", action: "accept_quest", style: "choice-accept" },
            { label: "❌ Refuser", action: "decline_quest", style: "choice-decline" },
          ],
        },
      ]);
      setStepIndex(0);
    } catch (err) {
      console.error("Quest generation failed:", err);
      setDialogueSteps([
        {
          type: "text",
          speaker: "Commandant Varek",
          text: "Hmm... Le tableau est vide aujourd'hui. Reviens plus tard, mercenaire.",
        },
      ]);
      setStepIndex(0);
    }

    isGenerating.current = false;
  }, [activeQuest, player, questHistory, openDialogue]);

  // ─── FORGE-MARTEAU: SHOP ───
  const handleTalkToArmorer = useCallback(() => {
    const affordable = ARMORER_ITEMS.filter((item) => {
      // Don't show items player already has (except potions)
      if (item.id === "health_potion") return true;
      return !player.inventory.includes(item.id);
    });

    if (affordable.length === 0) {
      openDialogue([
        {
          type: "text",
          speaker: "Forge-Marteau",
          text: "*regarde son stock vide* T'as déjà tout acheté. Reviens quand j'aurai du nouveau.",
        },
      ]);
      return;
    }

    // Build shop choices (max 3 items + leave)
    const shopItems = affordable.slice(0, 3);
    const choices = shopItems.map((item) => ({
      label: `${item.name} — ${item.cost} or (${item.stat === "hp" ? `+${item.bonus} PV` : `+${item.bonus} ${item.stat.toUpperCase()}`})`,
      action: `buy_${item.id}`,
      style: player.gold >= item.cost ? "choice-accept" : "choice-disabled",
    }));
    choices.push({ label: "Rien pour l'instant", action: "leave_shop", style: "choice-decline" });

    openDialogue([
      {
        type: "text",
        speaker: "Forge-Marteau",
        text: "*frappe l'enclume* ... Hm ? Tu veux du matériel ? Regarde ce que j'ai.",
      },
      {
        type: "choice",
        speaker: "Forge-Marteau",
        text: `Tu as ${player.gold} pièces d'or. Qu'est-ce qui t'intéresse ?`,
        choices,
      },
    ]);
  }, [player, openDialogue]);

  // ─── DOOR ───
  const handleDoor = useCallback(() => {
    if (!activeQuest) {
      openDialogue([
        {
          type: "text",
          speaker: "Porte de la guilde",
          speakerColor: "#8b7355",
          text: "Les terres de Cendrebourg s'étendent au-delà. Accepte un contrat auprès du Commandant Varek avant de partir.",
        },
      ]);
    } else {
      openDialogue([
        {
          type: "text",
          speaker: "Porte de la guilde",
          speakerColor: "#6fa0e0",
          text: `Tu pars en mission : "${activeQuest.title}". Destination : ${activeQuest.location_name}. Bonne chasse, mercenaire.`,
        },
        {
          type: "text",
          speaker: "— Système —",
          speakerColor: "#5a4a35",
          text: "⚠️ Les zones de quête arrivent dans la prochaine mise à jour. Pour l'instant, tu peux simuler un retour de mission.",
        },
        {
          type: "choice",
          speaker: "— Système —",
          speakerColor: "#5a4a35",
          text: "Simuler la complétion de la quête ?",
          choices: [
            { label: "✅ Oui — compléter la quête", action: "complete_quest", style: "choice-accept" },
            { label: "❌ Non — rester à la guilde", action: "cancel", style: "choice-decline" },
          ],
        },
      ]);
    }
  }, [activeQuest, openDialogue]);

  // ─── CHEST ───
  const handleChest = useCallback(() => {
    const invText = player.inventory.length > 0
      ? `Contenu : ${player.inventory.map(id => {
          const item = ARMORER_ITEMS.find(i => i.id === id);
          return item ? item.name : id;
        }).join(", ")}.`
      : "Le coffre est vide. Rapporte du butin de tes missions.";

    openDialogue([
      {
        type: "text",
        speaker: "Coffre de la guilde",
        speakerColor: "#8b7355",
        text: invText,
      },
    ]);
  }, [player.inventory, openDialogue]);

  // ─── HANDLE CHOICES ───
  const handleChoice = useCallback(
    (action) => {
      // Accept quest
      if (action === "accept_quest" && pendingQuest) {
        setActiveQuest(pendingQuest);
        setPendingQuest(null);
        closeDialogue();
        openDialogue([
          {
            type: "text",
            speaker: "Commandant Varek",
            text: `Contrat accepté : "${pendingQuest.title}". ${pendingQuest.enemy_hint ? `Un conseil : ${pendingQuest.enemy_hint}.` : ""} Équipe-toi chez Forge-Marteau si nécessaire, puis prends la porte.`,
          },
        ]);
        return;
      }

      // Decline quest
      if (action === "decline_quest") {
        setPendingQuest(null);
        closeDialogue();
        openDialogue([
          {
            type: "text",
            speaker: "Commandant Varek",
            text: "Comme tu veux. Le contrat reste sur le tableau si tu changes d'avis.",
          },
        ]);
        return;
      }

      // Buy item
      if (action.startsWith("buy_")) {
        const itemId = action.replace("buy_", "");
        const item = ARMORER_ITEMS.find((i) => i.id === itemId);
        if (!item) { closeDialogue(); return; }

        if (player.gold < item.cost) {
          closeDialogue();
          openDialogue([
            {
              type: "text",
              speaker: "Forge-Marteau",
              text: `T'as pas assez d'or pour ça. Il te faut ${item.cost} pièces. Reviens après une mission.`,
            },
          ]);
          return;
        }

        // Apply purchase
        setPlayer((prev) => {
          const updated = { ...prev, gold: prev.gold - item.cost };
          if (item.stat === "atk") updated.atk = prev.atk + item.bonus;
          else if (item.stat === "def") updated.def = prev.def + item.bonus;
          else if (item.stat === "hp") {
            updated.hp = Math.min(prev.maxHp, prev.hp + item.bonus);
          }
          if (item.id !== "health_potion") {
            updated.inventory = [...prev.inventory, item.id];
          }
          return updated;
        });

        closeDialogue();
        const statText = item.stat === "hp"
          ? `+${item.bonus} PV restaurés`
          : `+${item.bonus} ${item.stat.toUpperCase()}`;
        openDialogue([
          {
            type: "text",
            speaker: "Forge-Marteau",
            text: `*tend ${item.name}* Voilà. ${statText}. Fais-en bon usage.`,
          },
        ]);
        return;
      }

      // Complete quest (simulation)
      if (action === "complete_quest" && activeQuest) {
        setPlayer((prev) => ({
          ...prev,
          gold: prev.gold + activeQuest.reward_gold,
          xp: prev.xp + activeQuest.reward_xp,
          level: prev.xp + activeQuest.reward_xp >= prev.level * 30
            ? prev.level + 1
            : prev.level,
        }));
        setQuestHistory((prev) => [...prev, activeQuest]);
        const reward = activeQuest;
        setActiveQuest(null);
        closeDialogue();
        openDialogue([
          {
            type: "text",
            speaker: "Commandant Varek",
            text: `Contrat rempli ! Voici ta paie : ${reward.reward_gold} pièces d'or et ${reward.reward_xp} points d'expérience. La guilde te remercie.`,
          },
        ]);
        return;
      }

      // Leave shop / cancel
      if (action === "leave_shop" || action === "cancel") {
        closeDialogue();
        return;
      }
    },
    [pendingQuest, player, activeQuest, closeDialogue, openDialogue]
  );

  // ─── INTERACT ───
  const handleInteract = useCallback(() => {
    const target = getFacingTile(playerPos, facing);
    const npc = getNPCAt(target.x, target.y);

    if (npc) {
      if (npc.type === "quest") handleTalkToVarek();
      else if (npc.type === "armor") handleTalkToArmorer();
      return;
    }

    const tile = GUILD_MAP[target.y]?.[target.x];
    if (tile === T.DOOR) handleDoor();
    else if (tile === T.CHEST) handleChest();
  }, [playerPos, facing, getFacingTile, getNPCAt, handleTalkToVarek, handleTalkToArmorer, handleDoor, handleChest]);

  // ─── ADVANCE DIALOGUE ───
  const advanceDialogue = useCallback(() => {
    if (!inDialogue) return;
    if (currentStep?.type === "choice" || currentStep?.type === "loading") return;

    if (stepIndex < dialogueSteps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      closeDialogue();
    }
  }, [inDialogue, currentStep, stepIndex, dialogueSteps.length, closeDialogue]);

  // ─── KEYBOARD ───
  const handleKeyDown = useCallback(
    (e) => {
      // In dialogue
      if (inDialogue) {
        if (INTERACT_KEYS.has(e.key)) {
          e.preventDefault();
          advanceDialogue();
        }
        if (e.key === "Escape") {
          if (currentStep?.type !== "loading") closeDialogue();
        }
        // Number keys for choices
        if (currentStep?.type === "choice" && currentStep.choices) {
          const num = parseInt(e.key);
          if (num >= 1 && num <= currentStep.choices.length) {
            e.preventDefault();
            handleChoice(currentStep.choices[num - 1].action);
          }
        }
        return;
      }

      // Movement
      const dir = KEY_MAP[e.key];
      if (dir) {
        e.preventDefault();
        setFacing(dir);
        const [dx, dy] = DIRECTIONS[dir];
        setPlayerPos((prev) => {
          const nx = prev.x + dx;
          const ny = prev.y + dy;
          const tile = GUILD_MAP[ny]?.[nx];
          if (tile !== undefined && WALKABLE.has(tile) && !getNPCAt(nx, ny)) {
            return { x: nx, y: ny };
          }
          return prev;
        });
      }

      // Interaction
      if (INTERACT_KEYS.has(e.key)) {
        e.preventDefault();
        handleInteract();
      }
    },
    [inDialogue, currentStep, advanceDialogue, closeDialogue, handleChoice, handleInteract, getNPCAt]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ─── INTERACTION HINTS ───
  useEffect(() => {
    const target = getFacingTile(playerPos, facing);
    const npc = getNPCAt(target.x, target.y);
    const tile = GUILD_MAP[target.y]?.[target.x];

    setHighlightedNPC(npc || null);

    if (npc) setShowHint(`Parler à ${npc.name}`);
    else if (tile === T.DOOR) setShowHint(activeQuest ? "Partir en mission" : "Sortir de la guilde");
    else if (tile === T.CHEST) setShowHint("Inventaire");
    else setShowHint(null);
  }, [playerPos, facing, activeQuest, getFacingTile, getNPCAt]);

  // Auto-focus
  useEffect(() => { gameRef.current?.focus(); }, []);

  // Torch positions (precomputed)
  const torchPositions = [];
  GUILD_MAP.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile === T.TORCH) torchPositions.push({ x, y });
    });
  });

  // ─── RENDER ───
  return (
    <div
      className="game-container"
      ref={gameRef}
      tabIndex={0}
      onClick={() => gameRef.current?.focus()}
    >
      {/* Header */}
      <div className="game-header">
        <div className="game-title">GUILDE DES CENDRES</div>
        <div className="game-subtitle">Mercenaires de Cendrebourg — RPG par IA</div>
      </div>

      {/* Game viewport */}
      <div
        className="game-viewport"
        style={{ width: MAP_W * TILE_SIZE, height: MAP_H * TILE_SIZE }}
      >
        {/* Torch lighting */}
        {torchPositions.map((t, i) => (
          <div
            key={`glow-${i}`}
            className="torch-glow"
            style={{
              left: t.x * TILE_SIZE - 60,
              top: t.y * TILE_SIZE - 20,
              width: TILE_SIZE + 120,
              height: TILE_SIZE + 100,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}

        {/* Tiles */}
        {GUILD_MAP.map((row, y) =>
          row.map((tile, x) => <Tile key={`${x}-${y}`} type={tile} x={x} y={y} />)
        )}

        {/* NPCs */}
        {NPCS.map((npc) => (
          <NPCSprite
            key={npc.id}
            npc={npc}
            isHighlighted={highlightedNPC?.id === npc.id}
          />
        ))}

        {/* Player */}
        <PlayerSprite pos={playerPos} facing={facing} />

        {/* Interact hint */}
        {showHint && !inDialogue && (
          <div
            className="interact-hint"
            style={{
              left: playerPos.x * TILE_SIZE + TILE_SIZE / 2,
              top: playerPos.y * TILE_SIZE - 20,
            }}
          >
            [E] {showHint}
          </div>
        )}

        {/* Dialogue */}
        {inDialogue && (
          <DialogueBox
            step={currentStep}
            onAdvance={advanceDialogue}
            onChoice={handleChoice}
            onClose={closeDialogue}
          />
        )}
      </div>

      {/* HUD */}
      <HUD player={player} activeQuest={activeQuest} />
    </div>
  );
}

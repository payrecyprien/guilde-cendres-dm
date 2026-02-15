import { useState, useEffect, useCallback, useRef } from "react";
import {
  TILE_SIZE, WALKABLE, DIRECTIONS, KEY_MAP, INTERACT_KEYS,
  SCENE, DEFAULT_PLAYER, T,
} from "./data/constants";
import { GUILD_MAP, GUILD_START, NPCS, DIALOGUES, TILE_INTERACTIONS } from "./data/guild";
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

  // ─── UI STATE ───
  const [dialogueKey, setDialogueKey] = useState(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [highlightedNPC, setHighlightedNPC] = useState(null);
  const [showHint, setShowHint] = useState(null);
  const [gameLog, setGameLog] = useState([]);

  const gameRef = useRef(null);

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

  const addLog = useCallback((msg) => {
    setGameLog((prev) => [...prev.slice(-19), { text: msg, time: Date.now() }]);
  }, []);

  // ─── INTERACT ───
  const handleInteract = useCallback(() => {
    const target = getFacingTile(playerPos, facing);
    const npc = getNPCAt(target.x, target.y);

    if (npc) {
      setDialogueKey(npc.type);
      setDialogueIndex(0);
      addLog(`Tu parles à ${npc.name}.`);
      return;
    }

    const tile = GUILD_MAP[target.y]?.[target.x];
    const interaction = TILE_INTERACTIONS[tile];
    if (interaction) {
      setDialogueKey(interaction);
      setDialogueIndex(0);
    }
  }, [playerPos, facing, getFacingTile, getNPCAt, addLog]);

  // ─── ADVANCE DIALOGUE ───
  const advanceDialogue = useCallback(() => {
    if (!dialogueKey) return;

    const lines = DIALOGUES[dialogueKey];
    if (!lines) {
      setDialogueKey(null);
      return;
    }

    if (dialogueIndex < lines.length - 1) {
      setDialogueIndex((i) => i + 1);
    } else {
      setDialogueKey(null);
    }
  }, [dialogueKey, dialogueIndex]);

  // ─── KEYBOARD ───
  const handleKeyDown = useCallback(
    (e) => {
      // In dialogue mode
      if (dialogueKey) {
        if (INTERACT_KEYS.has(e.key)) {
          e.preventDefault();
          advanceDialogue();
        }
        if (e.key === "Escape") {
          setDialogueKey(null);
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
    [dialogueKey, advanceDialogue, handleInteract, getNPCAt]
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
    else if (tile === T.DOOR) setShowHint("Sortir de la guilde");
    else if (tile === T.CHEST) setShowHint("Ouvrir le coffre");
    else setShowHint(null);
  }, [playerPos, facing, getFacingTile, getNPCAt]);

  // Auto-focus
  useEffect(() => {
    gameRef.current?.focus();
  }, []);

  // ─── PRECOMPUTE TORCH POSITIONS ───
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
        <div className="game-subtitle">RPG à génération procédurale par IA</div>
      </div>

      {/* Game viewport */}
      <div
        className="game-viewport"
        style={{
          width: MAP_W * TILE_SIZE,
          height: MAP_H * TILE_SIZE,
        }}
      >
        {/* Torch ambient lighting */}
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
          row.map((tile, x) => (
            <Tile key={`${x}-${y}`} type={tile} x={x} y={y} />
          ))
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
        {showHint && !dialogueKey && (
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
        {dialogueKey && (
          <DialogueBox
            dialogueKey={dialogueKey}
            dialogueIndex={dialogueIndex}
          />
        )}
      </div>

      {/* HUD */}
      <HUD
        player={player}
        activeQuest={activeQuest}
        mapWidth={MAP_W * TILE_SIZE}
      />
    </div>
  );
}

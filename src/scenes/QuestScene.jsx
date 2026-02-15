import { TILE_SIZE } from "../data/constants";
import ZoneTile from "../components/ZoneTile";
import MonsterSprite from "../components/MonsterSprite";

export default function QuestScene({
  zoneData,
  zoneBiome,
  monsters,
  highlightedMonster,
  playerPos,
  objectiveUnlocked,
}) {
  if (!zoneData || !zoneBiome) return null;

  const hasLimitedVision = zoneBiome.limitedVision;
  const visionRadius = zoneBiome.visionRadius || 3;
  const visionPx = visionRadius * TILE_SIZE;
  // Player center in pixels
  const px = playerPos.x * TILE_SIZE + TILE_SIZE / 2;
  const py = playerPos.y * TILE_SIZE + TILE_SIZE / 2;

  return (
    <>
      {/* Fog overlay */}
      <div className="zone-fog" style={{ background: zoneBiome.fog }} />

      {/* Tiles */}
      {zoneData.grid.map((row, y) =>
        row.map((tile, x) => (
          <ZoneTile
            key={`z${x}-${y}`}
            type={tile}
            x={x}
            y={y}
            biome={zoneBiome}
            objectiveUnlocked={objectiveUnlocked}
          />
        ))
      )}

      {/* Monsters */}
      {monsters.map((m, i) => (
        <MonsterSprite
          key={`m${i}`}
          monster={m}
          isHighlighted={highlightedMonster?.x === m.x && highlightedMonster?.y === m.y}
        />
      ))}

      {/* FOG OF WAR — radial vision mask */}
      {hasLimitedVision && (
        <div
          className="fog-of-war"
          style={{
            background: `radial-gradient(
              ellipse ${visionPx}px ${visionPx}px at ${px}px ${py}px,
              transparent 0%,
              transparent 50%,
              ${zoneBiome.visionColor || "rgba(0,0,0,0.97)"} 85%,
              ${zoneBiome.visionColor || "rgba(0,0,0,0.97)"} 100%
            )`,
          }}
        />
      )}
    </>
  );
}

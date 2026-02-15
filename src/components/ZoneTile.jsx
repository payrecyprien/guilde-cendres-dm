import { TILE_SIZE } from "../data/constants";
import { ZT } from "../data/zones";

const BASE = {
  position: "absolute",
  width: TILE_SIZE,
  height: TILE_SIZE,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function ZoneTile({ type, x, y, biome, objectiveUnlocked }) {
  const style = { ...BASE, left: x * TILE_SIZE, top: y * TILE_SIZE };

  switch (type) {
    case ZT.FLOOR:
      return (
        <div style={{
          ...style,
          background: (x + y) % 2 === 0 ? biome.floor1 : biome.floor2,
          borderRight: "1px solid rgba(0,0,0,0.1)",
          borderBottom: "1px solid rgba(0,0,0,0.1)",
        }} />
      );

    case ZT.WALL:
      return (
        <div style={{ ...style, background: biome.wall }}>
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(135deg, ${biome.wallDetail}44, ${biome.wall}, ${biome.wallDetail}22)`,
            borderBottom: "2px solid rgba(0,0,0,0.3)",
            borderRight: "1px solid rgba(0,0,0,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, opacity: 0.6,
          }}>
            {biome.wallIcon}
          </div>
        </div>
      );

    case ZT.OBSTACLE:
      return (
        <div style={{
          ...style,
          background: (x + y) % 2 === 0 ? biome.floor1 : biome.floor2,
        }}>
          <div style={{
            width: "70%", height: "70%", borderRadius: 4,
            background: biome.obstacle,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, opacity: 0.7,
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}>
            {biome.obstacleIcon}
          </div>
        </div>
      );

    case ZT.ENTRY:
      return (
        <div style={{ ...style, background: biome.floor1 }}>
          <div style={{
            width: "90%", height: "100%",
            background: "linear-gradient(180deg, transparent, rgba(212,168,86,0.15))",
            borderBottom: "3px solid #d4a856",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 10, color: "#d4a856", animation: "doorPulse 2s ease-in-out infinite" }}>▲</span>
          </div>
        </div>
      );

    case ZT.OBJECTIVE:
      return (
        <div style={{ ...style, background: biome.floor1 }}>
          {objectiveUnlocked ? (
            <div className="objective-tile">
              <span className="objective-icon">⭐</span>
            </div>
          ) : (
            <div className="objective-tile-locked">
              <span className="objective-icon-locked">🔒</span>
            </div>
          )}
        </div>
      );

    default:
      return <div style={{ ...style, background: biome.floor1 }} />;
  }
}

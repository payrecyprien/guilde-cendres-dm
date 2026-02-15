import { TILE_SIZE } from "../data/constants";

export default function NPCSprite({ npc, isHighlighted }) {
  const c = npc.colors;

  return (
    <div
      className="npc-sprite"
      style={{
        left: npc.x * TILE_SIZE,
        top: npc.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
      }}
    >
      <div className={`npc-body-wrap ${isHighlighted ? "highlighted" : ""}`}>
        {/* Head */}
        <div
          className="npc-head"
          style={{
            background: `radial-gradient(circle at 40% 35%, ${c.head}, #b08850)`,
            borderColor: "#8a6840",
          }}
        />
        {/* Body */}
        <div
          className="npc-torso"
          style={{
            background: `linear-gradient(180deg, ${c.body}, ${c.body}dd)`,
            borderColor: `${c.body}88`,
          }}
        >
          <span className="npc-icon">{c.icon}</span>
        </div>
      </div>

      {/* Name tag on highlight */}
      {isHighlighted && (
        <div className="npc-name-tag">{npc.name}</div>
      )}
    </div>
  );
}

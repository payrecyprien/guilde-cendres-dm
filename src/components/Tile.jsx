import { T, TILE_SIZE } from "../data/constants";

const BASE = {
  position: "absolute",
  width: TILE_SIZE,
  height: TILE_SIZE,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function Tile({ type, x, y }) {
  const style = { ...BASE, left: x * TILE_SIZE, top: y * TILE_SIZE };

  switch (type) {
    case T.WALL:
      return (
        <div style={{ ...style, background: "#1c1812" }}>
          <div className="wall-inner">
            <div className="wall-brick" />
          </div>
        </div>
      );

    case T.FLOOR:
      return (
        <div
          style={{
            ...style,
            background: (x + y) % 2 === 0 ? "#2e2720" : "#322b23",
          }}
          className="floor-tile"
        />
      );

    case T.DOOR:
      return (
        <div style={{ ...style, background: "#2e2720" }}>
          <div className="door-tile">
            <div className="door-arrow">▼</div>
          </div>
        </div>
      );

    case T.TABLE:
      return (
        <div style={{ ...style, background: (x + y) % 2 === 0 ? "#2e2720" : "#322b23" }}>
          <div className="table-top" />
        </div>
      );

    case T.COUNTER:
      return (
        <div style={{ ...style, background: "#2e2720" }}>
          <div className="counter-tile">
            <div className="counter-line" />
          </div>
        </div>
      );

    case T.CHEST:
      return (
        <div style={{ ...style, background: (x + y) % 2 === 0 ? "#2e2720" : "#322b23" }}>
          <div className="chest-body">
            <div className="chest-lid" />
            <div className="chest-lock" />
          </div>
        </div>
      );

    case T.BARREL:
      return (
        <div style={{ ...style, background: (x + y) % 2 === 0 ? "#2e2720" : "#322b23" }}>
          <div className="barrel-body">
            <div className="barrel-ring barrel-ring-top" />
            <div className="barrel-ring barrel-ring-bot" />
          </div>
        </div>
      );

    case T.RUG:
      return (
        <div style={{ ...style, background: "#3a2222" }} className="rug-tile">
          <div className="rug-pattern" />
        </div>
      );

    case T.CARPET_V:
      return <div style={{ ...style, background: "#352828" }} className="carpet-v" />;

    case T.TORCH:
      return (
        <div style={{ ...style, background: "#1c1812" }}>
          <div className="wall-inner" style={{ position: "relative" }}>
            <div className="torch-handle" />
            <div className="torch-flame" />
          </div>
        </div>
      );

    case T.SHELF:
      return (
        <div style={{ ...style, background: "#1c1812" }}>
          <div className="shelf-body">
            <div className="shelf-line" />
            <div className="shelf-line" />
            <div className="shelf-line" />
          </div>
        </div>
      );

    case T.WEAPON_RACK:
      return (
        <div style={{ ...style, background: "#1c1812" }}>
          <div className="weapon-rack">
            <span>⚔</span><span>🗡</span><span>🪓</span>
          </div>
        </div>
      );

    case T.PILLAR:
      return (
        <div style={{ ...style, background: (x + y) % 2 === 0 ? "#2e2720" : "#322b23" }}>
          <div className="pillar-body">
            <div className="pillar-cap" />
          </div>
        </div>
      );

    default:
      return <div style={{ ...style, background: "#2e2720" }} />;
  }
}

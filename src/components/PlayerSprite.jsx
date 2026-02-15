import { TILE_SIZE } from "../data/constants";

export default function PlayerSprite({ pos, facing }) {
  return (
    <div
      className="player-sprite"
      style={{
        left: pos.x * TILE_SIZE,
        top: pos.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
      }}
    >
      <div className="player-body-wrap">
        {/* Head */}
        <div className="player-head">
          <div className="player-hair" />
        </div>
        {/* Body */}
        <div className="player-torso">
          <div className="player-belt" />
        </div>
      </div>

      {/* Direction indicator */}
      <div className={`player-direction dir-${facing}`} />
    </div>
  );
}

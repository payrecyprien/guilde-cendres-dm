export default function HUD({ player, activeQuest }) {
  return (
    <div className="hud">
      {/* Stats */}
      <div className="hud-stats">
        <div className="hud-stat">
          <div className="hud-dot" style={{ background: "#c0392b" }} />
          <span className="hud-label">HP</span>
          <span className="hud-value">{player.hp}/{player.maxHp}</span>
        </div>
        <div className="hud-stat">
          <div className="hud-dot" style={{ background: "#8b6914" }} />
          <span className="hud-label">ATK</span>
          <span className="hud-value">{player.atk}</span>
        </div>
        <div className="hud-stat">
          <div className="hud-dot" style={{ background: "#4a6080" }} />
          <span className="hud-label">DEF</span>
          <span className="hud-value">{player.def}</span>
        </div>
        <div className="hud-stat">
          <div className="hud-dot" style={{ background: "#d4a856" }} />
          <span className="hud-label">Gold</span>
          <span className="hud-value">{player.gold}</span>
        </div>
        <div className="hud-stat">
          <div className="hud-dot" style={{ background: "#6a9f4a" }} />
          <span className="hud-label">Lvl</span>
          <span className="hud-value">{player.level}</span>
        </div>
      </div>

      {/* Active quest */}
      {activeQuest && (
        <div className="hud-quest">
          <span className="hud-quest-icon">📜</span>
          <span className="hud-quest-title">{activeQuest.title}</span>
        </div>
      )}

      {/* Controls */}
      <div className="hud-controls">
        <span><b>WASD</b> move</span>
        <span><b>E</b> interact</span>
      </div>
    </div>
  );
}

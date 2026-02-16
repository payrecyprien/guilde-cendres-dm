import { INGREDIENTS } from "../data/crafting";

export default function HUD({ player, activeQuest }) {
  const xpThreshold = player.level * 30;
  const xpPercent = Math.min(100, Math.round((player.xp / xpThreshold) * 100));

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

      {/* XP bar */}
      <div className="hud-xp">
        <span className="hud-xp-label">XP</span>
        <div className="hud-xp-track">
          <div className="hud-xp-fill" style={{ width: `${xpPercent}%` }} />
        </div>
        <span className="hud-xp-text">{player.xp}/{xpThreshold}</span>
      </div>

      {/* Active quest */}
      {activeQuest && (
        <div className="hud-quest">
          <span className="hud-quest-icon">📜</span>
          <span className="hud-quest-title">{activeQuest.title}</span>
        </div>
      )}

      {/* Materials */}
      {player.ingredients?.length > 0 && (
        <div className="hud-materials">
          <span className="hud-mat-label">🔨</span>
          {player.ingredients.map((id, i) => (
            <span key={i} className="hud-mat-icon" title={id}>
              {INGREDIENTS[id]?.icon || "?"}
            </span>
          ))}
        </div>
      )}

      {/* Potions */}
      {(player.potions || 0) > 0 && (
        <div className="hud-materials">
          <span className="hud-mat-label">🧪</span>
          <span className="hud-mat-icon">{player.potions}</span>
        </div>
      )}

      {/* Controls */}
      <div className="hud-controls">
        <span><b>WASD</b> move</span>
        <span><b>E</b> interact</span>
        <span><b>J</b> journal</span>
        <span><b>T</b> dev panel</span>
      </div>
    </div>
  );
}

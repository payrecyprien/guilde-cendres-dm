import { useEffect, useRef } from "react";

export default function CombatScene({
  combat,
  player,
  onAction,
  onEnd,
  zoneBiome,
}) {
  const { phase, monster, monsterHp, turnNumber, combatLog, loot, monsterPortrait, portraitLoading } = combat;
  const logRef = useRef(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [combatLog]);

  if (!monster) return null;

  const hpPercent = Math.max(0, (monsterHp / monster.hp) * 100);
  const playerHpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
  const isEnded = phase === "victory" || phase === "defeat" || phase === "fled";

  return (
    <div className="combat-container">
      {/* Background */}
      <div className="combat-bg" style={{
        background: zoneBiome
          ? `radial-gradient(ellipse at center, ${zoneBiome.floor1}88 0%, #0d0a07 70%)`
          : "radial-gradient(ellipse at center, #1a1510 0%, #0d0a07 70%)",
      }} />

      {/* Monster display */}
      <div className="combat-monster-area">
        <div className="combat-monster-sprite">
          {/* AI portrait or fallback sprite */}
          {monsterPortrait ? (
            <div className={`combat-portrait-wrap ${monsterHp <= 0 ? "monster-dead" : ""} ${phase === "resolving" ? "monster-shake" : ""}`}>
              <img
                src={monsterPortrait}
                alt={monster.name}
                className="combat-portrait-img"
              />
            </div>
          ) : (
            <div className={`combat-monster-body ${phase === "resolving" ? "monster-shake" : ""} ${monsterHp <= 0 ? "monster-dead" : ""}`}>
              {portraitLoading && <div className="portrait-loading-spinner" />}
              <div className="combat-monster-head" />
              <div className="combat-monster-torso">
                <span className="combat-monster-icon">👹</span>
              </div>
            </div>
          )}
        </div>

        <div className="combat-monster-info">
          <div className="combat-monster-name">{monster.name}</div>
          <div className="combat-hp-bar">
            <div className="combat-hp-fill monster-hp" style={{ width: `${hpPercent}%` }} />
            <span className="combat-hp-text">{monsterHp} / {monster.hp}</span>
          </div>
          <div className="combat-monster-stats">
            ATK {monster.atk} · DEF {monster.def}
          </div>
        </div>
      </div>

      {/* Combat log */}
      <div className="combat-log" ref={logRef}>
        {combatLog.map((entry, i) => (
          <div key={i} className={`log-entry log-${entry.type}`}>
            <span className="log-text">{entry.text}</span>
            {entry.damage && <span className="log-damage">{entry.damage}</span>}
          </div>
        ))}
        {phase === "resolving" && (
          <div className="log-entry log-system">
            <span className="log-text loading-dots-text">⏳ ...</span>
          </div>
        )}
      </div>

      {/* Player area */}
      <div className="combat-player-area">
        <div className="combat-player-info">
          <div className="combat-player-name">Mercenary</div>
          <div className="combat-hp-bar">
            <div className="combat-hp-fill player-hp" style={{ width: `${playerHpPercent}%` }} />
            <span className="combat-hp-text">{player.hp} / {player.maxHp}</span>
          </div>
          <div className="combat-player-stats">
            ATK {player.atk} · DEF {player.def} · Tour {turnNumber}
          </div>
        </div>

        {/* Actions */}
        {phase === "choose" && (
          <div className="combat-actions">
            <button className="combat-btn btn-attack" onClick={() => onAction("attack")}>
              <span className="btn-icon">⚔</span>
              <span className="btn-label">Attack</span>
            </button>
            <button className="combat-btn btn-defend" onClick={() => onAction("defend")}>
              <span className="btn-icon">🛡</span>
              <span className="btn-label">Defend</span>
            </button>
            <button
              className={`combat-btn btn-potion ${(player.potions || 0) <= 0 || player.hp >= player.maxHp ? "btn-disabled" : ""}`}
              onClick={() => (player.potions || 0) > 0 && player.hp < player.maxHp && onAction("potion")}
            >
              <span className="btn-icon">🧪</span>
              <span className="btn-label">Potion ({player.potions || 0})</span>
            </button>
            <button className="combat-btn btn-flee" onClick={() => onAction("flee")}>
              <span className="btn-icon">🏃</span>
              <span className="btn-label">Flee</span>
            </button>
          </div>
        )}

        {phase === "resolving" && (
          <div className="combat-actions">
            <div className="combat-waiting">The battle rages on...</div>
          </div>
        )}

        {isEnded && (
          <div className="combat-end">
            {phase === "victory" && loot && (
              <div className="combat-loot">
                Loot: <span className="loot-gold">+{loot.gold} gold</span> · <span className="loot-xp">+{loot.xp} XP</span>
              </div>
            )}
            {phase === "defeat" && (
              <div className="combat-defeat-text">You have been defeated...</div>
            )}
            {phase === "fled" && (
              <div className="combat-fled-text">You managed to escape.</div>
            )}
            <button className="combat-btn btn-continue" onClick={onEnd}>
              <span className="btn-label">Continue</span>
            </button>
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="combat-keys">
        {phase === "choose" && (
          <>
            <span><b>[1]</b> Attack</span>
            <span><b>[2]</b> Defend</span>
            <span><b>[3]</b> Potion</span>
            <span><b>[4]</b> Flee</span>
          </>
        )}
        {isEnded && <span><b>[E]</b> Continue</span>}
      </div>
    </div>
  );
}

/**
 * Dialogue system supporting:
 * - Static text lines
 * - Loading state (waiting for AI)
 * - Player choices (accept/decline, buy items)
 */
export default function DialogueBox({ step, onAdvance, onChoice, onClose }) {
  if (!step) return null;

  return (
    <div className="dialogue-box">
      {/* Speaker */}
      <div
        className="dialogue-speaker"
        style={{ color: step.speakerColor || "#d4a856" }}
      >
        {step.speaker}
      </div>

      {/* Text */}
      <div className="dialogue-text">
        {step.type === "loading" ? (
          <span className="dialogue-loading">
            <span className="loading-dots">⏳</span> {step.text || "..."}
          </span>
        ) : (
          step.text
        )}
      </div>

      {/* Quest detail block */}
      {step.questDetail && (
        <div className="dialogue-quest-detail">
          <div className="quest-detail-title">📜 {step.questDetail.title}</div>
          <div className="quest-detail-desc">{step.questDetail.description}</div>
          <div className="quest-detail-meta">
            <span>📍 {step.questDetail.location_name}</span>
            <span>⚔ Difficulty {step.questDetail.difficulty}/5</span>
            <span>💰 {step.questDetail.reward_gold} gold</span>
            <span>✨ {step.questDetail.reward_xp} XP</span>
          </div>
        </div>
      )}

      {/* Choices */}
      {step.type === "choice" && step.choices && (
        <div className="dialogue-choices">
          {step.choices.map((c, i) => (
            <button
              key={i}
              className={`dialogue-choice-btn ${c.style || ""}`}
              onClick={() => onChoice(c.action)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      {step.type !== "choice" && step.type !== "loading" && (
        <div className="dialogue-controls">
          <span className="blink-text">[E]</span> continuer
          <span className="dialogue-sep">|</span>
          <span className="blink-text">[ESC]</span> fermer
        </div>
      )}

      {step.type === "choice" && (
        <div className="dialogue-controls">
          <span style={{ color: "#5a4a35" }}>Choose an option · Click or [1] [2]</span>
          <span className="dialogue-sep">|</span>
          <span className="blink-text">[ESC]</span> fermer
        </div>
      )}
    </div>
  );
}

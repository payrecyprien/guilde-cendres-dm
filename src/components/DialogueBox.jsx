import { DIALOGUES } from "../data/guild";

export default function DialogueBox({ dialogueKey, dialogueIndex }) {
  const lines = DIALOGUES[dialogueKey];
  if (!lines) return null;

  const line = lines[Math.min(dialogueIndex, lines.length - 1)];
  const isNPC = dialogueKey === "quest" || dialogueKey === "armor";

  return (
    <div className="dialogue-box">
      <div
        className="dialogue-speaker"
        style={{ color: isNPC ? "#d4a856" : "#8b7355" }}
      >
        {line.speaker}
      </div>
      <div className="dialogue-text">{line.text}</div>
      <div className="dialogue-controls">
        <span className="blink-text">[E]</span> continuer
        <span className="dialogue-sep">|</span>
        <span className="blink-text">[ESC]</span> fermer
      </div>
    </div>
  );
}

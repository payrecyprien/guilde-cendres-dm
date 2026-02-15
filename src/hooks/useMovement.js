import { useState, useEffect, useCallback, useRef } from "react";
import { DIRECTIONS, KEY_MAP, INTERACT_KEYS } from "../data/constants";

/**
 * Hook for player movement and keyboard input.
 * Uses refs for callbacks to avoid circular dependency issues in production builds.
 */
export default function useMovement({ initialPos = { x: 6, y: 7 }, initialFacing = "up" }) {
  const [pos, setPos] = useState(initialPos);
  const [facing, setFacing] = useState(initialFacing);

  // Callback refs — always up-to-date, no circular deps
  const callbacksRef = useRef({
    isWalkable: () => false,
    onInteract: () => {},
    dialogueOpen: false,
    onDialogueAdvance: () => {},
    onDialogueClose: () => {},
    dialogueStep: null,
    onChoice: () => {},
    disabled: false,
  });

  // Update callbacks (called every render from the component)
  const updateCallbacks = useCallback((cbs) => {
    Object.assign(callbacksRef.current, cbs);
  }, []);

  const resetPosition = useCallback((newPos, newFacing = "up") => {
    setPos(newPos);
    setFacing(newFacing);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const cbs = callbacksRef.current;

      if (cbs.disabled) return;

      // ─── DIALOGUE MODE ───
      if (cbs.dialogueOpen) {
        if (INTERACT_KEYS.has(e.key)) {
          e.preventDefault();
          cbs.onDialogueAdvance?.();
        }
        if (e.key === "Escape" && cbs.dialogueStep?.type !== "loading") {
          cbs.onDialogueClose?.();
        }
        if (cbs.dialogueStep?.type === "choice" && cbs.dialogueStep.choices) {
          const num = parseInt(e.key);
          if (num >= 1 && num <= cbs.dialogueStep.choices.length) {
            e.preventDefault();
            cbs.onChoice?.(cbs.dialogueStep.choices[num - 1].action);
          }
        }
        return;
      }

      // ─── MOVEMENT ───
      const dir = KEY_MAP[e.key];
      if (dir) {
        e.preventDefault();
        setFacing(dir);
        const [dx, dy] = DIRECTIONS[dir];
        setPos((prev) => {
          const nx = prev.x + dx;
          const ny = prev.y + dy;
          return cbs.isWalkable(nx, ny) ? { x: nx, y: ny } : prev;
        });
      }

      // ─── INTERACT ───
      if (INTERACT_KEYS.has(e.key)) {
        e.preventDefault();
        cbs.onInteract?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // Single listener, reads from ref

  return { pos, facing, setPos, setFacing, resetPosition, updateCallbacks };
}

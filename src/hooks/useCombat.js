import { useState, useCallback, useRef } from "react";
import { COMBAT_SYSTEM_PROMPT, buildCombatUserMessage } from "../data/prompts";
import { getCombatNarration, generateMonsterPortrait } from "../utils/api";

/**
 * Combat states:
 * - "choose"   → player picks action
 * - "resolving" → waiting for AI narration
 * - "narrating" → showing narration text
 * - "victory"  → monster dead
 * - "defeat"   → player dead
 * - "fled"     → player escaped
 */

export default function useCombat() {
  const [phase, setPhase] = useState("choose");
  const [monster, setMonster] = useState(null);
  const [monsterHp, setMonsterHp] = useState(0);
  const [turnNumber, setTurnNumber] = useState(1);
  const [combatLog, setCombatLog] = useState([]);
  const [lastNarration, setLastNarration] = useState(null);
  const [loot, setLoot] = useState(null);
  const [monsterPortrait, setMonsterPortrait] = useState(null);
  const [portraitLoading, setPortraitLoading] = useState(false);

  const isProcessing = useRef(false);

  const startCombat = useCallback((monsterData, biomeName) => {
    setMonster(monsterData);
    setMonsterHp(monsterData.hp);
    setTurnNumber(1);
    setCombatLog([{
      type: "system",
      text: `${monsterData.name} appears! ${monsterData.description || ""}`,
    }]);
    setLastNarration(null);
    setLoot(null);
    setMonsterPortrait(null);
    setPhase("choose");

    // Generate portrait asynchronously
    setPortraitLoading(true);
    generateMonsterPortrait(monsterData.name, monsterData.description, biomeName)
      .then((url) => {
        setMonsterPortrait(url);
        setPortraitLoading(false);
      })
      .catch(() => setPortraitLoading(false));
  }, []);

  const executeAction = useCallback(async (action, playerStats, location) => {
    if (isProcessing.current || phase !== "choose") return null;
    isProcessing.current = true;
    setPhase("resolving");

    // ─── DAMAGE CALCULATION (client-side, deterministic with variance) ───
    const variance = () => 0.8 + Math.random() * 0.4; // 0.8 to 1.2

    let playerDmg = 0;
    let monsterDmg = 0;
    let playerDefending = false;
    let fled = false;

    switch (action) {
      case "attack":
        playerDmg = Math.max(2, Math.round((playerStats.atk - monster.def) * 2 * variance()));
        monsterDmg = Math.max(1, Math.round((monster.atk - playerStats.def) * 2 * variance()));
        break;

      case "defend":
        playerDefending = true;
        monsterDmg = Math.max(0, Math.round((monster.atk - playerStats.def * 1.5) * variance()));
        break;

      case "flee":
        fled = Math.random() < 0.5 + (playerStats.def > monster.atk ? 0.2 : -0.1);
        if (!fled) {
          monsterDmg = Math.max(1, Math.round((monster.atk - playerStats.def * 0.5) * 2 * variance()));
        }
        break;
    }

    // Apply damage
    const newMonsterHp = Math.max(0, monsterHp - playerDmg);
    const newPlayerHp = Math.max(0, playerStats.hp - monsterDmg);
    setMonsterHp(newMonsterHp);

    // ─── AI NARRATION (async, non-blocking for gameplay) ───
    const actionLabel = action === "attack" ? "Attack"
      : action === "defend" ? "Defend"
      : fled ? "Successful escape" : "Failed escape attempt";

    let narration;
    try {
      narration = await getCombatNarration(
        COMBAT_SYSTEM_PROMPT,
        buildCombatUserMessage({
          playerAction: actionLabel,
          playerStats: { ...playerStats, hp: newPlayerHp },
          monsterStats: { ...monster, hp: newMonsterHp },
          monsterName: monster.name,
          monsterDesc: monster.description,
          turnNumber,
          location,
        })
      );
    } catch {
      narration = {
        player_action_text: action === "attack" ? "You strike the creature." : action === "defend" ? "You raise your guard." : "You attempt to flee.",
        monster_action_text: monsterDmg > 0 ? "The creature retaliates." : "The creature hesitates.",
        ambient_text: null,
      };
    }

    setLastNarration(narration);

    // Build log entries
    const newEntries = [];

    if (narration.player_action_text) {
      newEntries.push({
        type: "player",
        text: narration.player_action_text,
        damage: playerDmg > 0 ? `-${playerDmg} HP` : null,
      });
    }

    if (fled) {
      newEntries.push({ type: "system", text: "You manage to escape!" });
      setCombatLog((prev) => [...prev, ...newEntries]);
      setPhase("fled");
      isProcessing.current = false;
      return { newPlayerHp, fled: true };
    }

    if (newMonsterHp <= 0) {
      newEntries.push({
        type: "system",
        text: `${monster.name} collapses! Victory!`,
      });
      const monsterLoot = { gold: monster.gold || 5, xp: monster.xp || 10 };
      setLoot(monsterLoot);
      setCombatLog((prev) => [...prev, ...newEntries]);
      setPhase("victory");
      isProcessing.current = false;
      return { newPlayerHp, victory: true, loot: monsterLoot };
    }

    if (narration.monster_action_text && monsterDmg > 0) {
      newEntries.push({
        type: "monster",
        text: narration.monster_action_text,
        damage: `-${monsterDmg} HP`,
      });
    } else if (narration.monster_action_text) {
      newEntries.push({ type: "monster", text: narration.monster_action_text });
    }

    if (narration.ambient_text) {
      newEntries.push({ type: "ambient", text: narration.ambient_text });
    }

    if (newPlayerHp <= 0) {
      newEntries.push({ type: "system", text: "You collapse... Defeat." });
      setCombatLog((prev) => [...prev, ...newEntries]);
      setPhase("defeat");
      isProcessing.current = false;
      return { newPlayerHp, defeat: true };
    }

    setCombatLog((prev) => [...prev, ...newEntries]);
    setTurnNumber((t) => t + 1);
    setPhase("choose");
    isProcessing.current = false;
    return { newPlayerHp, damage: monsterDmg };
  }, [phase, monster, monsterHp, turnNumber]);

  return {
    phase,
    monster,
    monsterHp,
    turnNumber,
    combatLog,
    lastNarration,
    loot,
    monsterPortrait,
    portraitLoading,
    startCombat,
    executeAction,
  };
}

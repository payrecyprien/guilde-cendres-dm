const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const BIOMES = {
  brumesombre: { name: "Brumesombre Forest", floor: "grass", walls: "trees", obstacle: "thick bushes" },
  ruines_nord: { name: "Northern Ruins", floor: "cracked tiles", walls: "collapsed walls", obstacle: "rubble" },
  mine: { name: "Abandoned Mine", floor: "rock", walls: "rock walls", obstacle: "cave-ins" },
  marais: { name: "Valtorve Marshes", floor: "muddy ground", walls: "deep water", obstacle: "reeds" },
  route_commerce: { name: "Trade Road", floor: "dirt path", walls: "boulders", obstacle: "broken carts" },
  village_est: { name: "Eastern Village", floor: "cobblestone", walls: "buildings", obstacle: "overturned stalls" },
};

function buildPrompt(quest) {
  const biome = BIOMES[quest.location] || BIOMES.brumesombre;

  return `You are an RPG level designer. You generate exploration zones for a tile-based game.

## CONTEXT
Quest: "${quest.title}"
${quest.description}
Location: ${biome.name}
Type: ${quest.type}
Difficulty: ${quest.difficulty}/5

## GRID RULES
- The grid is exactly 14 columns × 10 rows
- Tile codes: 0 = floor (${biome.floor}), 1 = wall/impassable (${biome.walls}), 2 = decorative obstacle (${biome.obstacle}), 3 = entry (only 1, at bottom), 4 = objective (only 1)
- The border (first/last row and column) MUST be walls (1), except the entry (3) at the bottom
- The entry (3) is in the middle of the last row
- The objective (4) is in the upper half of the map
- Leave walkable paths between the entry and the objective
- Place some obstacles (2) to create an interesting layout, not an empty corridor
- Floor (0) should be the majority of interior tiles

## MONSTERS
- ALWAYS generate between 2 and 3 monsters, regardless of quest type
- Each monster has a position (x, y) on a floor tile (0)
- Monsters must NOT be on the entry, objective, or a wall
- Give them original names (no generic "giant wolf" or "skeleton")

## FORMAT (strict JSON, nothing else)
{
  "grid": [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ...10 rows of 14 columns...
  ],
  "monsters": [
    {
      "name": "Unique name",
      "x": 5,
      "y": 4,
      "hp": 30,
      "atk": 6,
      "def": 2,
      "xp": 12,
      "gold": 8,
      "description": "short description (1 sentence)"
    }
  ],
  "ambiance": "1 sentence describing the atmosphere of the location"
}`;
}

function parseJSON(text) {
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Validate and fix common grid issues
function validateGrid(grid) {
  if (!grid || !Array.isArray(grid)) return null;

  // Ensure exactly 10 rows
  while (grid.length < 10) grid.push(new Array(14).fill(1));
  grid = grid.slice(0, 10);

  // Ensure exactly 14 columns per row
  grid = grid.map((row) => {
    if (!Array.isArray(row)) return new Array(14).fill(1);
    while (row.length < 14) row.push(1);
    return row.slice(0, 14);
  });

  // Ensure borders are walls
  for (let x = 0; x < 14; x++) {
    grid[0][x] = 1;
    if (x !== 6 && x !== 7) grid[9][x] = 1;
  }
  for (let y = 0; y < 10; y++) {
    grid[y][0] = 1;
    grid[y][13] = 1;
  }

  // Ensure entry exists
  grid[9][6] = 3;
  grid[9][7] = 3;

  // Ensure at least one objective exists
  let hasObjective = false;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 14; x++) {
      if (grid[y][x] === 4) hasObjective = true;
    }
  }
  if (!hasObjective) {
    // Place objective in upper area
    for (let y = 1; y < 4; y++) {
      for (let x = 1; x < 13; x++) {
        if (grid[y][x] === 0) {
          grid[y][x] = 4;
          hasObjective = true;
          break;
        }
      }
      if (hasObjective) break;
    }
  }

  return grid;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const { quest } = req.body;
  if (!quest) return res.status(400).json({ error: "Missing quest" });

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1200,
        temperature: 0.85,
        system: buildPrompt(quest),
        messages: [{ role: "user", content: "Generate the exploration zone." }],
      }),
    });

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";
    const zone = parseJSON(rawText);

    if (!zone || !zone.grid) {
      return res.status(200).json({ error: "Zone parsing failed", raw: rawText });
    }

    zone.grid = validateGrid(zone.grid);

    // Validate monster positions
    if (zone.monsters) {
      zone.monsters = zone.monsters.filter((m) => {
        const tile = zone.grid[m.y]?.[m.x];
        return tile === 0 && m.x > 0 && m.x < 13 && m.y > 0 && m.y < 9;
      });
    }

    // Fallback: ensure at least 2 monsters
    if (!zone.monsters || zone.monsters.length < 2) {
      const fallbackMonsters = [];
      for (let y = 2; y < 8 && fallbackMonsters.length < 2; y++) {
        for (let x = 2; x < 12 && fallbackMonsters.length < 2; x++) {
          if (zone.grid[y][x] === 0) {
            const existing = (zone.monsters || []).some((m) => m.x === x && m.y === y);
            if (!existing) {
              fallbackMonsters.push({
                name: fallbackMonsters.length === 0 ? "Shadow Prowler" : "Scavenger",
                x, y, hp: 25 + Math.floor(Math.random() * 15),
                atk: 4 + Math.floor(Math.random() * 3),
                def: 1 + Math.floor(Math.random() * 2),
                xp: 10, gold: 8,
                description: "A hostile creature lurks in the area.",
              });
            }
          }
        }
      }
      zone.monsters = [...(zone.monsters || []), ...fallbackMonsters];
    }

    return res.status(200).json(zone);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

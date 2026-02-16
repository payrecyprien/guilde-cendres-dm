const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const BIOMES = {
  gloomhaze: { name: "Gloomhaze Forest", floor: "grass", walls: "trees", obstacle: "thick bushes" },
  northern_ruins: { name: "Northern Ruins", floor: "cracked tiles", walls: "collapsed walls", obstacle: "rubble" },
  mine: { name: "Abandoned Mine", floor: "rock", walls: "rock walls", obstacle: "cave-ins" },
  marshes: { name: "Grimfen Marshes", floor: "muddy ground", walls: "deep water", obstacle: "reeds" },
  trade_road: { name: "Trade Road", floor: "dirt path", walls: "boulders", obstacle: "broken carts" },
  east_village: { name: "Eastern Village", floor: "cobblestone", walls: "buildings", obstacle: "overturned stalls" },
};

function getZoneSize(difficulty) {
  const sizes = {
    1: { w: 14, h: 10, monsters: "2 to 3" },
    2: { w: 16, h: 11, monsters: "2 to 3" },
    3: { w: 18, h: 12, monsters: "3 to 4" },
    4: { w: 20, h: 14, monsters: "3 to 4" },
    5: { w: 22, h: 14, monsters: "4 to 5" },
  };
  return sizes[difficulty] || sizes[1];
}

const SHAPE_POOL = [
  "L-shaped: a corridor turns 90 degrees, with rooms at each end",
  "T-shaped: a main corridor with a branch splitting off to one side",
  "U-shaped: two parallel paths connected at one end, open at the other",
  "Winding cave: an organic, snaking path with irregular walls and alcoves",
  "Two rooms connected by a narrow corridor",
  "Central chamber with 2-3 branching tunnels radiating outward",
  "Zigzag path: the route snakes back and forth across the grid",
  "Ring: a circular or oval loop path around a central wall cluster",
];

function buildPrompt(quest) {
  const biome = BIOMES[quest.location] || BIOMES.gloomhaze;
  const size = getZoneSize(quest.difficulty || 1);
  const shape = SHAPE_POOL[Math.floor(Math.random() * SHAPE_POOL.length)];

  return `You are an RPG level designer. You generate exploration zones for a tile-based game.

## CONTEXT
Quest: "${quest.title}"
${quest.description}
Location: ${biome.name}
Type: ${quest.type}
Difficulty: ${quest.difficulty}/5

## SHAPE
The zone must have a NON-RECTANGULAR layout. The overall shape must be: ${shape}.
Use walls (1) as void/rock to carve out this shape within the grid. The playable floor area should clearly follow the described shape. Do NOT make a boring rectangle with walls only on the border.

## GRID RULES
- The grid is exactly ${size.w} columns × ${size.h} rows
- Tile codes: 0 = floor (${biome.floor}), 1 = wall/impassable (${biome.walls}), 2 = decorative obstacle (${biome.obstacle}), 3 = entry (only 1), 4 = objective (only 1)
- The outer border of the grid is always walls (1), except the entry tile (3)
- The entry (3) must be on the bottom row, accessible from the playable area
- The objective (4) must be far from the entry, placed at the end of the shape
- There MUST be a walkable path from entry to objective
- Scatter obstacles (2) within floor areas for visual interest
- Floor tiles (0) should form the shape described above, not fill the whole interior

## MONSTERS
- Generate between ${size.monsters} monsters
- Each monster has a position (x, y) on a floor tile (0)
- Monsters must NOT be on the entry, objective, or a wall
- Give them original names (no generic "giant wolf" or "skeleton")
- Scale monster stats to difficulty: higher difficulty = tougher monsters

## WRITING STYLE for text fields
- NEVER use em-dashes, semicolons, or ellipsis
- No purple prose: no "looming", "piercing", "echoes through", "a testament to"
- Short punchy descriptions. Write like a terse novelist.

## FEW-SHOT EXAMPLE
Here is a CORRECT 8×6 L-shaped zone (your grid will be ${size.w}×${size.h}, but this shows the pattern):
{
  "grid": [
    [1,1,1,1,1,1,1,1],
    [1,0,0,0,1,1,1,1],
    [1,0,2,0,1,1,1,1],
    [1,0,0,0,0,0,4,1],
    [1,1,0,0,0,2,0,1],
    [1,1,1,3,1,1,1,1]
  ],
  "monsters": [
    { "name": "Gravelaw Hound", "x": 3, "y": 1, "hp": 25, "atk": 5, "def": 2, "xp": 10, "gold": 6, "description": "A dog-sized rodent with stone-crusted teeth." }
  ],
  "ambiance": "Dust hangs in the air. Something scratches behind the walls."
}
Key observations:
- L-shape: floor goes vertical (rows 1-2) then turns horizontal (rows 3-4). NOT a rectangle.
- Walls (1) fill unused space to carve the shape.
- Entry (3) on bottom row. Objective (4) far from entry, at the end of the L.
- Monster at (3,1) is on a floor tile (0), not on entry/objective/wall.
- Obstacle (2) scattered for visual interest, not blocking the path.

Now generate YOUR zone at ${size.w}×${size.h} using the ${shape} shape.

## FORMAT (strict JSON, nothing else)
{
  "grid": [
    [${Array(size.w).fill(1).join(",")}],
    ...${size.h} rows of ${size.w} columns...
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

  const { quest, temperature: clientTemp } = req.body;
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
        max_tokens: 2000,
        temperature: clientTemp ?? 0.85,
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

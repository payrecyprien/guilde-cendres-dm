// ─── ZONE TILE TYPES ───
// 0 = floor, 1 = wall, 2 = obstacle, 3 = entry, 4 = objective
export const ZT = {
  FLOOR: 0,
  WALL: 1,
  OBSTACLE: 2,
  ENTRY: 3,
  OBJECTIVE: 4,
};

export const ZONE_WALKABLE = new Set([ZT.FLOOR, ZT.ENTRY, ZT.OBJECTIVE]);

// ─── BIOME PALETTES ───
export const BIOME_STYLES = {
  brumesombre: {
    name: "Forêt de Brumesombre",
    floor1: "#2a3520", floor2: "#283218",
    wall: "#1a2810", wallDetail: "#3a5025",
    obstacle: "#354a28", obstacleIcon: "🌿",
    entry: "#2a3520", objective: "#3a5025",
    wallIcon: "🌲",
    fog: "rgba(80, 120, 80, 0.04)",
    limitedVision: true,
    visionRadius: 3.5,
    visionColor: "rgba(8, 15, 5, 0.97)",
  },
  ruines_nord: {
    name: "Ruines du Nord",
    floor1: "#2e2a28", floor2: "#322e2a",
    wall: "#1c1a18", wallDetail: "#4a4540",
    obstacle: "#3a3530", obstacleIcon: "🪨",
    entry: "#2e2a28", objective: "#3a3530",
    wallIcon: "🧱",
    fog: "rgba(100, 90, 80, 0.04)",
    limitedVision: false,
  },
  mine: {
    name: "Mine abandonnée",
    floor1: "#28241e", floor2: "#2c2820",
    wall: "#181510", wallDetail: "#4a4030",
    obstacle: "#352e22", obstacleIcon: "⛏",
    entry: "#28241e", objective: "#352e22",
    wallIcon: "⬛",
    fog: "rgba(60, 50, 40, 0.06)",
    limitedVision: true,
    visionRadius: 2.5,
    visionColor: "rgba(5, 4, 2, 0.98)",
  },
  marais: {
    name: "Marais de Valtorve",
    floor1: "#282e22", floor2: "#2a3024",
    wall: "#1a2018", wallDetail: "#3a4a30",
    obstacle: "#303828", obstacleIcon: "🌾",
    entry: "#282e22", objective: "#303828",
    wallIcon: "💧",
    fog: "rgba(60, 90, 60, 0.06)",
    limitedVision: true,
    visionRadius: 4,
    visionColor: "rgba(10, 15, 8, 0.95)",
  },
  route_commerce: {
    name: "Route commerciale",
    floor1: "#302a22", floor2: "#342e24",
    wall: "#1c1810", wallDetail: "#5a4a35",
    obstacle: "#3a3225", obstacleIcon: "📦",
    entry: "#302a22", objective: "#3a3225",
    wallIcon: "🪵",
    fog: "rgba(100, 80, 50, 0.03)",
    limitedVision: false,
  },
  village_est: {
    name: "Village de l'Est",
    floor1: "#2e2820", floor2: "#322c24",
    wall: "#1a1510", wallDetail: "#4a3d2e",
    obstacle: "#352e22", obstacleIcon: "🏺",
    entry: "#2e2820", objective: "#352e22",
    wallIcon: "🏠",
    fog: "rgba(80, 60, 40, 0.04)",
    limitedVision: false,
  },
};

export function getBiomeStyle(locationId) {
  return BIOME_STYLES[locationId] || BIOME_STYLES.brumesombre;
}

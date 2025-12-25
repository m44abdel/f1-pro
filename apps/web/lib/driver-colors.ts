/**
 * Driver and Team color management for F1 Pro
 * Handles driver transfers between seasons
 * Updated for 2025 season
 */

// Team colors (consistent across seasons)
export const TEAM_COLORS: Record<string, string> = {
  "Red Bull Racing": "#3671C6",
  "Mercedes": "#27F4D2",
  "Ferrari": "#E8002D",
  "McLaren": "#FF8000",
  "Alpine": "#FF87BC",
  "AlphaTauri": "#5E8FAA",
  "RB": "#6692FF", 
  "Aston Martin": "#229971",
  "Williams": "#64C4FF",
  "Alfa Romeo": "#C92D4B",
  "Sauber": "#52E252", // Kick Sauber green for 2025
  "Haas": "#B6BABD",
  "Unknown": "#666666",
};

// Driver to team mappings by season
export const DRIVER_TEAMS: Record<number, Record<string, string>> = {
  2024: {
    // Red Bull Racing
    VER: "Red Bull Racing",
    PER: "Red Bull Racing",
    // Mercedes
    HAM: "Mercedes",
    RUS: "Mercedes",
    // Ferrari
    LEC: "Ferrari",
    SAI: "Ferrari",
    BEA: "Ferrari", // Bearman substitute at Saudi Arabia
    // McLaren
    NOR: "McLaren",
    PIA: "McLaren",
    // Alpine
    OCO: "Alpine",
    GAS: "Alpine",
    // AlphaTauri/RB
    TSU: "RB",
    RIC: "RB",
    DEV: "RB", // De Vries early season
    LAW: "RB", // Lawson substitute
    // Aston Martin
    ALO: "Aston Martin",
    STR: "Aston Martin",
    // Williams
    ALB: "Williams",
    SAR: "Williams",
    COL: "Williams", // Colapinto replaced Sargeant mid-season
    // Alfa Romeo / Sauber
    BOT: "Sauber",
    ZHO: "Sauber",
    // Haas
    MAG: "Haas",
    HUL: "Haas",
  },
  2025: {
    // Red Bull Racing - Perez out, Lawson promoted
    VER: "Red Bull Racing",
    LAW: "Red Bull Racing", // Lawson promoted from RB
    // Mercedes - Hamilton out, Antonelli in
    RUS: "Mercedes",
    ANT: "Mercedes", // Kimi Antonelli rookie
    // Ferrari - Sainz out, Hamilton in
    HAM: "Ferrari", // Hamilton joins Ferrari
    LEC: "Ferrari",
    // McLaren - unchanged
    NOR: "McLaren",
    PIA: "McLaren",
    // Alpine - Ocon out, Doohan in
    GAS: "Alpine",
    DOO: "Alpine", // Jack Doohan rookie
    // RB - Lawson promoted, Hadjar in
    TSU: "RB",
    HAD: "RB", // Isack Hadjar rookie
    // Aston Martin - unchanged
    ALO: "Aston Martin",
    STR: "Aston Martin",
    // Williams - Sargeant/Colapinto out, Sainz in
    ALB: "Williams",
    SAI: "Williams", // Sainz joins from Ferrari
    // Kick Sauber - Zhou out, Bottas out, Hulkenberg in, Bortoleto in
    HUL: "Sauber", // Hulkenberg joins from Haas
    BOR: "Sauber", // Gabriel Bortoleto rookie
    // Haas - Magnussen out, Hulkenberg out, Ocon in, Bearman in
    OCO: "Haas", // Ocon joins from Alpine
    BEA: "Haas", // Oliver Bearman promoted
  },
};

/**
 * Get the color for a driver based on their team in a specific season
 * @param driverCode - Three-letter driver code
 * @param season - Year (defaults to 2024)
 * @returns Hex color code
 */
export function getDriverColor(driverCode: string, season: number = 2024): string {
  const code = driverCode?.toUpperCase();
  if (!code) return TEAM_COLORS.Unknown;
  
  const seasonData = DRIVER_TEAMS[season];
  if (!seasonData) {
    // If season not found, try to use closest available season
    const availableSeasons = Object.keys(DRIVER_TEAMS).map(Number).sort((a, b) => b - a);
    for (const s of availableSeasons) {
      const data = DRIVER_TEAMS[s];
      if (data[code]) {
        const team = data[code];
        return TEAM_COLORS[team] || TEAM_COLORS.Unknown;
      }
    }
    return TEAM_COLORS.Unknown;
  }
  
  const team = seasonData[code] || "Unknown";
  return TEAM_COLORS[team] || TEAM_COLORS.Unknown;
}

/**
 * Get team name for a driver in a specific season
 * @param driverCode - Three-letter driver code
 * @param season - Year
 * @returns Team name
 */
export function getDriverTeam(driverCode: string, season: number): string {
  const code = driverCode?.toUpperCase();
  if (!code) return "Unknown";
  
  const seasonData = DRIVER_TEAMS[season];
  if (!seasonData) return "Unknown";
  
  return seasonData[code] || "Unknown";
}

/**
 * Get all drivers for a specific team in a season
 * @param teamName - Team name
 * @param season - Year
 * @returns Array of driver codes
 */
export function getTeamDrivers(teamName: string, season: number): string[] {
  const seasonData = DRIVER_TEAMS[season];
  if (!seasonData) return [];
  
  return Object.entries(seasonData)
    .filter(([_, team]) => team === teamName)
    .map(([driver, _]) => driver);
}

/**
 * Get all available seasons
 * @returns Array of years
 */
export function getAvailableSeasons(): number[] {
  return Object.keys(DRIVER_TEAMS).map(Number).sort((a, b) => b - a);
}

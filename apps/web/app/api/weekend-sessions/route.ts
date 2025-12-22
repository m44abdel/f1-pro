import { NextRequest, NextResponse } from "next/server";

// Check which sessions are available for a specific F1 weekend
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = searchParams.get("season");
    const round = searchParams.get("round");
    
    if (!season || !round) {
      return NextResponse.json(
        { success: false, error: "Season and round are required" },
        { status: 400 }
      );
    }

    // Use fastf1 API to check available sessions
    // For 2024 season, we know which races have sprints
    const sprintWeekends2024 = [
      5,  // China
      6,  // Miami  
      11, // Austria
      18, // USA (Austin)
      21, // Brazil
      23, // Qatar
    ];

    const sprintWeekends2025 = [
      // Add 2025 sprint weekends when announced
      5,  // China (confirmed)
      6,  // Miami (confirmed)
      // More to be announced
    ];

    const yearNum = parseInt(season);
    const roundNum = parseInt(round);
    
    let availableSessions = ["Q", "R"]; // Qualifying and Race are always available
    
    // Check if this weekend has a sprint
    if (yearNum === 2024 && sprintWeekends2024.includes(roundNum)) {
      availableSessions.push("S", "SS"); // Add Sprint and Sprint Shootout
    } else if (yearNum === 2025 && sprintWeekends2025.includes(roundNum)) {
      availableSessions.push("S", "SS");
    }
    
    return NextResponse.json({
      success: true,
      sessions: availableSessions,
      hasSprint: availableSessions.includes("S")
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

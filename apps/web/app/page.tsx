import { getPool } from "@/lib/db";

interface QualifyingResult {
  season: number;
  round: number;
  weekend_name: string;
  circuit: string;
  date: string;
  session_code: string;
  driver_code: string;
  driver_name: string;
  position: number;
  best_lap_time_ms: number | null;
}

function formatLapTime(ms: number | null): string {
  if (!ms) return "-";
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3);
  return minutes > 0 ? `${minutes}:${seconds.padStart(6, "0")}` : `${seconds}s`;
}

export default async function Home() {
  let results: QualifyingResult[] = [];
  let error: string | null = null;

  try {
    const pool = getPool();
    const res = await pool.query(`
      SELECT 
        w.season,
        w.round,
        w.name as weekend_name,
        w.circuit,
        w.date,
        s.session_code,
        d.code as driver_code,
        d.name as driver_name,
        sr.position,
        sr.best_lap_time_ms
      FROM session_results sr
      JOIN sessions s ON sr.session_id = s.id
      JOIN weekends w ON s.weekend_id = w.id
      JOIN drivers d ON sr.driver_id = d.id
      ORDER BY w.season DESC, w.round DESC, sr.position ASC
    `);
    results = res.rows;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch data";
  }

  return (
    <main style={{ 
      padding: "2rem", 
      fontFamily: "system-ui, -apple-system, sans-serif",
      maxWidth: "900px",
      margin: "0 auto"
    }}>
      <h1 style={{ 
        fontSize: "2.5rem", 
        fontWeight: "700",
        marginBottom: "0.5rem"
      }}>
        F1 Pro
      </h1>
      
      {error ? (
        <div style={{ 
          background: "#fee2e2", 
          color: "#dc2626", 
          padding: "1rem", 
          borderRadius: "8px",
          marginTop: "1rem"
        }}>
          <strong>Error:</strong> {error}
        </div>
      ) : results.length === 0 ? (
        <p style={{ color: "#666" }}>No data yet. Run the ingest script to load F1 data.</p>
      ) : (
        <>
          <p style={{ color: "#666", marginBottom: "2rem" }}>
            {results[0]?.weekend_name} - {results[0]?.circuit} ({results[0]?.season})
          </p>
          
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Qualifying Results
          </h2>
          
          <table style={{ 
            width: "100%", 
            borderCollapse: "collapse",
            fontSize: "0.95rem"
          }}>
            <thead>
              <tr style={{ 
                borderBottom: "2px solid #e5e7eb",
                textAlign: "left"
              }}>
                <th style={{ padding: "0.75rem 0.5rem" }}>Pos</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Driver</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Code</th>
                <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>Best Time</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr 
                  key={`${r.driver_code}-${r.position}`}
                  style={{ 
                    borderBottom: "1px solid #e5e7eb",
                    background: i < 3 ? "#fef3c7" : "transparent"
                  }}
                >
                  <td style={{ 
                    padding: "0.75rem 0.5rem",
                    fontWeight: i < 3 ? "700" : "400"
                  }}>
                    P{r.position}
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    {r.driver_name}
                  </td>
                  <td style={{ 
                    padding: "0.75rem 0.5rem",
                    fontFamily: "monospace",
                    fontWeight: "600"
                  }}>
                    {r.driver_code}
                  </td>
                  <td style={{ 
                    padding: "0.75rem 0.5rem",
                    textAlign: "right",
                    fontFamily: "monospace"
                  }}>
                    {formatLapTime(r.best_lap_time_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <p style={{ 
            marginTop: "2rem", 
            fontSize: "0.85rem", 
            color: "#9ca3af" 
          }}>
            Data loaded from Neon PostgreSQL • {results.length} drivers
          </p>
        </>
      )}
    </main>
  );
}

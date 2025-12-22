"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface RaceDriver {
  driver_id: number | string;
  driver_code: string;
  driver_name: string;
  final_position: number | null;
  laps: Array<{
    lap_number: number;
    lap_time_ms: number | null;
    compound: string | null;
    stint: number | null;
    is_personal_best: boolean | null;
  }>;
  stints: Array<{
    stint_number: number;
    compound: string;
    start_lap: number;
    end_lap: number | null;
    tire_age_at_start: number;
  }>;
  pit_stops: Array<{
    lap_number: number;
    duration_ms: number | null;
    pit_in_time: string | null;
    pit_out_time: string | null;
  }>;
}

interface PositionData {
  lap_number: number;
  positions: Array<{
    driver_id: number | string;
    driver_code: string;
    position: number;
    gap_to_leader_ms: number | null;
    interval_ms: number | null;
  }>;
}

interface SessionInfo {
  id: number;
  session_code: string;
  weekend_name: string;
  circuit: string;
  season: number;
  round: number;
}

const TIRE_COLORS: Record<string, string> = {
  SOFT: "#ef4444",      // Red
  MEDIUM: "#eab308",    // Yellow
  HARD: "#f8f8f8",      // White
  INTERMEDIATE: "#22c55e", // Green
  WET: "#3b82f6",       // Blue
};

// F1 team colors
const DRIVER_COLORS: Record<string, string> = {
  VER: "#3671C6",
  PER: "#3671C6",
  HAM: "#6CD3BF",
  RUS: "#6CD3BF",
  LEC: "#F91536",
  SAI: "#F91536",
  NOR: "#F58020",
  PIA: "#F58020",
  ALO: "#229971",
  STR: "#229971",
  GAS: "#5E8FAA",
  OCO: "#5E8FAA",
  TSU: "#6692FF",
  RIC: "#6692FF",
  BOT: "#C92D4B",
  ZHO: "#C92D4B",
  MAG: "#B6BABD",
  HUL: "#B6BABD",
  ALB: "#64C4FF",
  SAR: "#64C4FF",
  DEFAULT: "#e10600",
};

function getDriverColor(code: string): string {
  return DRIVER_COLORS[code] || DRIVER_COLORS.DEFAULT;
}

function formatLapTime(ms: number | null): string {
  if (!ms) return "-";
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3);
  return minutes > 0 ? `${minutes}:${seconds.padStart(6, "0")}` : seconds;
}

function formatGap(ms: number | null): string {
  if (!ms) return "-";
  if (ms < 1000) return `${(ms / 1000).toFixed(3)}`;
  return `+${(ms / 1000).toFixed(1)}s`;
}

export default function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [raceData, setRaceData] = useState<{
    drivers: RaceDriver[];
    positions: PositionData[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<"timing" | "stints" | "positions" | "laptimes">("timing");
  const [currentLap, setCurrentLap] = useState<number | null>(null);

  // Fetch session info
  useEffect(() => {
    fetch(`/api/session/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSession(data.data.session);
        }
      });
  }, [id]);

  // Fetch race data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/race/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRaceData(data.data);
          // Auto-select top 5 drivers
          const topDrivers = data.data.drivers
            .sort((a: RaceDriver, b: RaceDriver) => (a.final_position || 99) - (b.final_position || 99))
            .slice(0, 5)
            .map((d: RaceDriver) => d.driver_code);
          setSelectedDrivers(topDrivers);
          // Set current lap to last lap
          if (data.data.positions.length > 0) {
            setCurrentLap(data.data.positions[data.data.positions.length - 1].lap_number);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading || !raceData) {
    return (
      <div className="min-h-screen bg-f1-black flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-2 border-f1-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxLaps = Math.max(...raceData.drivers.flatMap(d => d.laps.map(l => l.lap_number)));
  const currentPositions = currentLap ? raceData.positions.find(p => p.lap_number === currentLap)?.positions || [] : [];

  return (
    <div className="min-h-screen bg-f1-black">
      {/* Header */}
      <header className="border-b border-f1-gray/30 bg-f1-dark/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/session/${id}`} className="text-f1-light hover:text-f1-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-f1-red rounded-full" />
              <h1 className="text-2xl font-bold tracking-tight">
                F1<span className="text-f1-red">Pro</span> Race
              </h1>
            </div>
          </div>
          {session && (
            <div className="text-right">
              <p className="text-f1-white font-semibold">{session.weekend_name}</p>
              <p className="text-f1-light text-sm">{session.session_code} - {session.circuit}</p>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* View Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "timing", label: "Timing Tower" },
            { key: "stints", label: "Stint Strategy" },
            { key: "positions", label: "Position Changes" },
            { key: "laptimes", label: "Lap Times" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key as typeof activeView)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeView === tab.key
                  ? "bg-f1-red text-white"
                  : "bg-f1-dark border border-f1-gray/30 text-f1-light hover:text-f1-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timing Tower View */}
        {activeView === "timing" && (
          <div className="grid grid-cols-12 gap-6">
            {/* Lap Selector */}
            <div className="col-span-3">
              <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
                <h3 className="text-sm font-semibold text-f1-light uppercase tracking-wider mb-4">
                  Lap {currentLap} / {maxLaps}
                </h3>
                <input
                  type="range"
                  min={1}
                  max={maxLaps}
                  value={currentLap || 1}
                  onChange={(e) => setCurrentLap(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-f1-light mt-2">
                  <span>Lap 1</span>
                  <span>Lap {maxLaps}</span>
                </div>
              </div>
            </div>

            {/* Timing Tower */}
            <div className="col-span-9">
              <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-f1-gray/30 text-f1-light text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3 w-16">Pos</th>
                      <th className="text-left px-4 py-3">Driver</th>
                      <th className="text-right px-4 py-3 w-24">Gap</th>
                      <th className="text-right px-4 py-3 w-24">Int</th>
                      <th className="text-center px-4 py-3 w-20">Tire</th>
                      <th className="text-right px-4 py-3 w-20">Laps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPositions.map((pos, i) => {
                      const driver = raceData.drivers.find(d => String(d.driver_id) === String(pos.driver_id));
                      const currentLapData = driver?.laps.find(l => l.lap_number === currentLap);
                      const stint = driver?.stints.find(s => 
                        currentLap! >= s.start_lap && (s.end_lap === null || currentLap! <= s.end_lap)
                      );
                      const tireAge = stint ? (currentLap! - stint.start_lap + stint.tire_age_at_start) : 0;
                      
                      return (
                        <tr
                          key={pos.driver_id}
                          className={`border-b border-f1-gray/10 transition-colors hover:bg-f1-gray/10 ${
                            i < 3 ? "bg-gradient-to-r from-f1-red/5 to-transparent" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                                i === 0
                                  ? "bg-yellow-500 text-black"
                                  : i === 1
                                  ? "bg-gray-300 text-black"
                                  : i === 2
                                  ? "bg-amber-600 text-white"
                                  : "bg-f1-gray/30 text-f1-light"
                              }`}
                            >
                              {pos.position}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span 
                                className="font-mono font-bold"
                                style={{ color: getDriverColor(pos.driver_code) }}
                              >
                                {pos.driver_code}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm">
                            {i === 0 ? "-" : formatGap(pos.gap_to_leader_ms)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-f1-light">
                            {i === 0 ? "-" : formatGap(pos.interval_ms)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {stint && (
                              <span
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold"
                                style={{
                                  backgroundColor: TIRE_COLORS[stint.compound] || "#666",
                                  color: stint.compound === "HARD" ? "#000" : "#fff"
                                }}
                              >
                                {stint.compound.charAt(0)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-f1-light">
                            {tireAge}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Stint Strategy View */}
        {activeView === "stints" && (
          <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
            <h3 className="text-sm font-semibold text-f1-light uppercase tracking-wider mb-4">
              Tire Strategy
            </h3>
            <div className="space-y-2">
              {raceData.drivers
                .sort((a, b) => (a.final_position || 99) - (b.final_position || 99))
                .map((driver) => (
                  <div key={driver.driver_id} className="flex items-center gap-4">
                    <div className="w-16 text-right">
                      <span className="font-mono font-bold" style={{ color: getDriverColor(driver.driver_code) }}>
                        {driver.driver_code}
                      </span>
                    </div>
                    <div className="flex-1 relative h-8 bg-f1-gray/20 rounded overflow-hidden">
                      {driver.stints.map((stint) => {
                        const startPercent = ((stint.start_lap - 1) / maxLaps) * 100;
                        const endLap = stint.end_lap || maxLaps;
                        const widthPercent = ((endLap - stint.start_lap + 1) / maxLaps) * 100;
                        
                        return (
                          <div
                            key={stint.stint_number}
                            className="absolute h-full flex items-center justify-center text-xs font-bold group"
                            style={{
                              left: `${startPercent}%`,
                              width: `${widthPercent}%`,
                              backgroundColor: TIRE_COLORS[stint.compound] || "#666",
                              color: stint.compound === "HARD" ? "#000" : "#fff"
                            }}
                          >
                            {stint.compound.charAt(0)}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-f1-dark/90 text-f1-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              Laps {stint.start_lap}-{endLap} ({endLap - stint.start_lap + 1} laps)
                            </div>
                          </div>
                        );
                      })}
                      {driver.pit_stops.map((stop) => (
                        <div
                          key={stop.lap_number}
                          className="absolute w-0.5 h-10 bg-f1-red z-10"
                          style={{
                            left: `${(stop.lap_number / maxLaps) * 100}%`,
                            top: "-4px"
                          }}
                        >
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-f1-dark/90 text-f1-white text-xs rounded opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap">
                            Lap {stop.lap_number} - {formatLapTime(stop.duration_ms)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-f1-light">
                      P{driver.final_position || "-"}
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex items-center gap-6 mt-4 text-xs text-f1-light">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: TIRE_COLORS.SOFT }} />
                <span>Soft</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: TIRE_COLORS.MEDIUM }} />
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: TIRE_COLORS.HARD }} />
                <span>Hard</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-0.5 h-4 bg-f1-red" />
                <span>Pit Stop</span>
              </div>
            </div>
          </div>
        )}

        {/* Position Changes View */}
        {activeView === "positions" && (() => {
          // Transform data for proper charting
          const positionChartData = raceData.positions.map(lap => {
            const dataPoint: any = { lap: lap.lap_number };
            selectedDrivers.forEach(driverCode => {
              const driver = raceData.drivers.find(d => d.driver_code === driverCode);
              if (driver) {
                const pos = lap.positions.find(p => String(p.driver_id) === String(driver.driver_id));
                dataPoint[driverCode] = pos?.position || null;
              }
            });
            return dataPoint;
          });

          return (
            <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
              <h3 className="text-sm font-semibold text-f1-light uppercase tracking-wider mb-4">
                Position Changes
              </h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={positionChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis
                      dataKey="lap"
                      stroke="#9ca3af"
                      fontSize={11}
                      label={{ value: "Lap", position: "insideBottom", offset: -5 }}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={11}
                      domain={[1, 20]}
                      reversed
                      ticks={[1, 5, 10, 15, 20]}
                      label={{ value: "Position", angle: -90, position: "insideLeft" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f1f27",
                        border: "1px solid #38383f",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelFormatter={(value) => `Lap ${value}`}
                    />
                    {selectedDrivers.map((driverCode) => (
                      <Line
                        key={driverCode}
                        type="monotone"
                        dataKey={driverCode}
                        stroke={getDriverColor(driverCode)}
                        strokeWidth={2}
                        dot={false}
                        name={driverCode}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Driver selector */}
              <div className="mt-4 flex flex-wrap gap-2">
              {raceData.drivers
                .sort((a, b) => (a.final_position || 99) - (b.final_position || 99))
                .map((driver) => {
                  const isSelected = selectedDrivers.includes(driver.driver_code);
                  return (
                    <button
                      key={driver.driver_id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedDrivers(prev => prev.filter(d => d !== driver.driver_code));
                        } else {
                          setSelectedDrivers(prev => [...prev, driver.driver_code]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border ${
                        isSelected
                          ? "text-white shadow-lg"
                          : "bg-f1-dark border-f1-gray/30 text-f1-light hover:border-f1-gray/50"
                      }`}
                      style={isSelected ? { 
                        backgroundColor: getDriverColor(driver.driver_code), 
                        borderColor: getDriverColor(driver.driver_code) 
                      } : {}}
                    >
                      {driver.driver_code} P{driver.final_position || "-"}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Lap Times View */}
        {activeView === "laptimes" && (() => {
          // Get all unique lap numbers from all selected drivers
          const allLapNumbers = new Set<number>();
          raceData.drivers
            .filter(d => selectedDrivers.includes(d.driver_code))
            .forEach(driver => {
              driver.laps.forEach(lap => {
                if (lap.lap_time_ms && lap.lap_time_ms < 120000) {
                  allLapNumbers.add(lap.lap_number);
                }
              });
            });
          
          // Create chart data with all drivers' lap times
          const lapTimeChartData = Array.from(allLapNumbers).sort((a, b) => a - b).map(lapNum => {
            const dataPoint: any = { lap: lapNum };
            
            selectedDrivers.forEach(driverCode => {
              const driver = raceData.drivers.find(d => d.driver_code === driverCode);
              if (driver) {
                const lap = driver.laps.find(l => l.lap_number === lapNum);
                dataPoint[driverCode] = lap?.lap_time_ms && lap.lap_time_ms < 120000 ? lap.lap_time_ms : null;
                dataPoint[`${driverCode}_pit`] = driver.pit_stops.some(p => p.lap_number === lapNum);
              }
            });
            
            return dataPoint;
          });

          return (
            <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
              <h3 className="text-sm font-semibold text-f1-light uppercase tracking-wider mb-4">
                Lap Time Comparison
              </h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lapTimeChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis
                      dataKey="lap"
                      stroke="#9ca3af"
                      fontSize={11}
                      label={{ value: "Lap", position: "insideBottom", offset: -5 }}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={11}
                      tickFormatter={(value) => formatLapTime(value)}
                      label={{ value: "Lap Time", angle: -90, position: "insideLeft" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f1f27",
                        border: "1px solid #38383f",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: any) => formatLapTime(value)}
                      labelFormatter={(value) => `Lap ${value}`}
                    />
                    {selectedDrivers.map((driverCode) => (
                      <Line
                        key={driverCode}
                        type="monotone"
                        dataKey={driverCode}
                        stroke={getDriverColor(driverCode)}
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isPitLap = payload[`${driverCode}_pit`];
                          if (isPitLap) {
                            return (
                              <circle cx={cx} cy={cy} r={4} fill="#e10600" stroke="#fff" strokeWidth={1} />
                            );
                          }
                          return null;
                        }}
                        name={driverCode}
                        connectNulls
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
              {/* Info */}
              <div className="mt-4 flex items-center gap-4 text-xs text-f1-light">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-f1-red" />
                  <span>Lap Time</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-f1-red border-2 border-white" />
                  <span>Pit Stop Lap</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

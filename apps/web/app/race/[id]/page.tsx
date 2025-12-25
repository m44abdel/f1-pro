"use client";

import { use, useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { getDriverColor as getDriverColorBySeason } from "@/lib/driver-colors";
import { SiteBrand } from "@/components/SiteBrand";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
  SOFT: "#ef4444",
  MEDIUM: "#eab308",
  HARD: "#f8f8f8",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
};

function getDriverColor(code: string, season?: number): string {
  return getDriverColorBySeason(code, season || 2024);
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

// Next 16/React 19: route params are a promise; unwrap with `use`
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
    if (!id) return;
    fetch(`/api/session/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSession(data.data.session);
        }
      })
      .catch(() => {});
  }, [id]);

  // Fetch race data
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/race/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRaceData(data.data);
          const topDrivers = data.data.drivers
            .sort((a: RaceDriver, b: RaceDriver) => (a.final_position || 99) - (b.final_position || 99))
            .slice(0, 5)
            .map((d: RaceDriver) => d.driver_code);
          setSelectedDrivers(topDrivers);
          if (data.data.positions.length > 0) {
            setCurrentLap(data.data.positions[data.data.positions.length - 1].lap_number);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Toggle driver selection
  const toggleDriver = useCallback((driverCode: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverCode) 
        ? prev.filter(d => d !== driverCode) 
        : [...prev, driverCode]
    );
  }, []);

  // Memoized values
  const maxLaps = useMemo(() => {
    if (!raceData) return 0;
    return Math.max(...raceData.drivers.flatMap(d => d.laps.map(l => l.lap_number)));
  }, [raceData]);

  const currentPositions = useMemo(() => {
    if (!currentLap || !raceData) return [];
    return raceData.positions.find(p => p.lap_number === currentLap)?.positions || [];
  }, [currentLap, raceData]);

  // Memoized position chart data
  const positionChartData = useMemo(() => {
    if (!raceData) return [];
    return raceData.positions.map(lap => {
      const dataPoint: Record<string, number | null> = { lap: lap.lap_number };
      selectedDrivers.forEach(driverCode => {
        const driver = raceData.drivers.find(d => d.driver_code === driverCode);
        if (driver) {
          const pos = lap.positions.find(p => String(p.driver_id) === String(driver.driver_id));
          dataPoint[driverCode] = pos?.position || null;
        }
      });
      return dataPoint;
    });
  }, [raceData, selectedDrivers]);

  // Memoized lap time chart data
  const lapTimeChartData = useMemo(() => {
    if (!raceData) return [];
    
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
    
    return Array.from(allLapNumbers).sort((a, b) => a - b).map(lapNum => {
      const dataPoint: Record<string, number | boolean | null> = { lap: lapNum };
      
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
  }, [raceData, selectedDrivers]);

  if (loading || !raceData) {
    return (
      <div className="min-h-screen bg-f1-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-3 border-f1-red border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Loading race data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-f1-black">
      {/* Header */}
      <header className="border-b border-f1-gray/30 bg-f1-dark/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-f1-gray/30 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <SiteBrand subtitle="Race Center" />
          </div>
          {session && (
            <div className="text-right">
              <p className="text-white font-semibold">{session.weekend_name}</p>
              <p className="text-gray-400 text-sm">{session.session_code} - {session.circuit}</p>
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
                  ? "bg-f1-red text-white shadow-lg"
                  : "bg-f1-dark/50 border border-f1-gray/30 text-gray-400 hover:text-white hover:bg-f1-dark"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timing Tower View */}
        {activeView === "timing" && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3">
              <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Lap {currentLap} / {maxLaps}
                </h3>
                <input
                  type="range"
                  min={1}
                  max={maxLaps}
                  value={currentLap || 1}
                  onChange={(e) => setCurrentLap(Number(e.target.value))}
                  className="w-full accent-f1-red"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Lap 1</span>
                  <span>Lap {maxLaps}</span>
                </div>
              </div>
            </div>

            <div className="col-span-9">
              <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-f1-gray/30 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3 w-16">Pos</th>
                      <th className="text-left px-4 py-3">Driver</th>
                      <th className="text-right px-4 py-3 w-24">Gap</th>
                      <th className="text-right px-4 py-3 w-24">Int</th>
                      <th className="text-center px-4 py-3 w-20">Tire</th>
                      <th className="text-right px-4 py-3 w-20">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPositions.map((pos, i) => {
                      const driver = raceData.drivers.find(d => String(d.driver_id) === String(pos.driver_id));
                      const stint = driver?.stints.find(s => 
                        currentLap! >= s.start_lap && (s.end_lap === null || currentLap! <= s.end_lap)
                      );
                      const tireAge = stint ? (currentLap! - stint.start_lap + stint.tire_age_at_start) : 0;
                      
                      return (
                        <tr
                          key={pos.driver_id}
                          className={`border-b border-f1-gray/10 transition-colors hover:bg-f1-gray/10 ${
                            i < 3 ? "bg-gradient-to-r from-f1-red/10 to-transparent" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                                i === 0 ? "bg-yellow-500 text-black"
                                  : i === 1 ? "bg-gray-300 text-black"
                                  : i === 2 ? "bg-amber-600 text-white"
                                  : "bg-f1-gray/30 text-gray-400"
                              }`}
                            >
                              {pos.position}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span 
                              className="font-mono font-bold"
                              style={{ color: getDriverColor(pos.driver_code, session?.season) }}
                            >
                              {pos.driver_code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-white">
                            {i === 0 ? "-" : formatGap(pos.gap_to_leader_ms)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">
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
                          <td className="px-4 py-3 text-right text-sm text-gray-400">
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
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
              Tire Strategy
            </h3>
            <div className="space-y-2">
              {raceData.drivers
                .sort((a, b) => (a.final_position || 99) - (b.final_position || 99))
                .map((driver) => (
                  <div key={driver.driver_id} className="flex items-center gap-4">
                    <div className="w-16 text-right">
                      <span className="font-mono font-bold" style={{ color: getDriverColor(driver.driver_code, session?.season) }}>
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
                            className="absolute h-full flex items-center justify-center text-xs font-bold cursor-pointer group"
                            style={{
                              left: `${startPercent}%`,
                              width: `${widthPercent}%`,
                              backgroundColor: TIRE_COLORS[stint.compound] || "#666",
                              color: stint.compound === "HARD" ? "#000" : "#fff"
                            }}
                          >
                            {stint.compound.charAt(0)}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-f1-dark border border-f1-gray/30 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                              Laps {stint.start_lap}-{endLap} ({endLap - stint.start_lap + 1} laps)
                            </div>
                          </div>
                        );
                      })}
                      {driver.pit_stops.map((stop) => (
                        <div
                          key={stop.lap_number}
                          className="absolute w-0.5 h-10 bg-f1-red z-10"
                          style={{ left: `${(stop.lap_number / maxLaps) * 100}%`, top: "-4px" }}
                        />
                      ))}
                    </div>
                    <div className="w-10 text-xs text-gray-400 text-center">
                      P{driver.final_position || "-"}
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex items-center gap-6 mt-6 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: TIRE_COLORS.SOFT }} />
                <span>Soft</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: TIRE_COLORS.MEDIUM }} />
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border border-gray-600" style={{ backgroundColor: TIRE_COLORS.HARD }} />
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
        {activeView === "positions" && (
          <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
              Position Changes
            </h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={positionChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="lap" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[1, 20]} reversed ticks={[1, 5, 10, 15, 20]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f1f27", border: "1px solid #38383f", borderRadius: "8px", fontSize: "12px" }}
                    labelFormatter={(value) => `Lap ${value}`}
                  />
                  {selectedDrivers.map((driverCode) => (
                    <Line
                      key={driverCode}
                      type="monotone"
                      dataKey={driverCode}
                      stroke={getDriverColor(driverCode, session?.season)}
                      strokeWidth={2}
                      dot={false}
                      name={driverCode}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {raceData.drivers
                .sort((a, b) => (a.final_position || 99) - (b.final_position || 99))
                .map((driver) => {
                  const isSelected = selectedDrivers.includes(driver.driver_code);
                  return (
                    <button
                      key={driver.driver_id}
                      onClick={() => toggleDriver(driver.driver_code)}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border-2 ${
                        isSelected ? "text-white shadow-lg" : "bg-f1-dark/50 border-f1-gray/30 text-gray-400 hover:border-f1-gray/50"
                      }`}
                      style={isSelected ? { backgroundColor: getDriverColor(driver.driver_code, session?.season), borderColor: getDriverColor(driver.driver_code, session?.season) } : {}}
                    >
                      {driver.driver_code} P{driver.final_position || "-"}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Lap Times View */}
        {activeView === "laptimes" && (
          <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
              Lap Time Comparison
            </h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lapTimeChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="lap" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(value) => formatLapTime(value)} domain={['dataMin - 2000', 'dataMax + 2000']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f1f27", border: "1px solid #38383f", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value) => [formatLapTime(value as number | null), ""]}
                    labelFormatter={(value) => `Lap ${value}`}
                  />
                  {selectedDrivers.map((driverCode) => (
                    <Line
                      key={driverCode}
                      type="monotone"
                      dataKey={driverCode}
                      stroke={getDriverColor(driverCode, session?.season)}
                      strokeWidth={2}
                      dot={false}
                      name={driverCode}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {raceData.drivers
                .sort((a, b) => (a.final_position || 99) - (b.final_position || 99))
                .map((driver) => {
                  const isSelected = selectedDrivers.includes(driver.driver_code);
                  return (
                    <button
                      key={driver.driver_id}
                      onClick={() => toggleDriver(driver.driver_code)}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border-2 ${
                        isSelected ? "text-white shadow-lg" : "bg-f1-dark/50 border-f1-gray/30 text-gray-400 hover:border-f1-gray/50"
                      }`}
                      style={isSelected ? { backgroundColor: getDriverColor(driver.driver_code, session?.season), borderColor: getDriverColor(driver.driver_code, session?.season) } : {}}
                    >
                      {driver.driver_code} P{driver.final_position || "-"}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

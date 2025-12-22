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
  ReferenceLine,
} from "recharts";
import TrackMap from "@/app/components/TrackMap";

interface TelemetryData {
  id: number;
  driver_id: number;
  driver_code: string;
  driver_name: string;
  lap_number: number;
  n_points: number;
  distance_m: number[];
  speed_kph: number[];
  throttle: number[];
  brake: number[];
  gear: number[];
  drs: number[] | null;
  pos_x: number[] | null;
  pos_y: number[] | null;
}

interface SessionInfo {
  id: number;
  session_code: string;
  weekend_name: string;
  circuit: string;
  season: number;
  round: number;
}

interface DriverOption {
  driver_id: number | string;
  driver_code: string;
  driver_name: string;
  position: number | null;
}

// F1 team colors (approximate)
const DRIVER_COLORS: Record<string, string> = {
  VER: "#3671C6", // Red Bull
  PER: "#3671C6",
  HAM: "#6CD3BF", // Mercedes
  RUS: "#6CD3BF",
  LEC: "#F91536", // Ferrari
  SAI: "#F91536",
  NOR: "#F58020", // McLaren
  PIA: "#F58020",
  ALO: "#229971", // Aston Martin
  STR: "#229971",
  GAS: "#5E8FAA", // Alpine
  OCO: "#5E8FAA",
  TSU: "#6692FF", // RB
  RIC: "#6692FF",
  BOT: "#C92D4B", // Sauber
  ZHO: "#C92D4B",
  MAG: "#B6BABD", // Haas
  HUL: "#B6BABD",
  ALB: "#64C4FF", // Williams
  SAR: "#64C4FF",
  // Default
  DEFAULT: "#e10600",
};

function getDriverColor(code: string): string {
  return DRIVER_COLORS[code] || DRIVER_COLORS.DEFAULT;
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<(number | string)[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDistance, setHoveredDistance] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeChart, setActiveChart] = useState<"speed" | "throttle" | "gear">("speed");
  const [trackColorMode, setTrackColorMode] = useState<"speed" | "throttle" | "brake">("speed");

  // Fetch session info and available drivers
  useEffect(() => {
    fetch(`/api/session/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSession(data.data.session);
          const driverOptions = data.data.results.map((r: DriverOption) => ({
            driver_id: r.driver_id,
            driver_code: r.driver_code,
            driver_name: r.driver_name,
            position: r.position,
          }));
          setDrivers(driverOptions);
          // Auto-select top 2 drivers
          if (driverOptions.length >= 2) {
            setSelectedDrivers([driverOptions[0].driver_id, driverOptions[1].driver_id]);
          }
        }
        setLoading(false);
      });
  }, [id]);

  // Fetch telemetry when drivers change
  useEffect(() => {
    if (selectedDrivers.length === 0) {
      setTelemetry([]);
      return;
    }

    fetch(`/api/telemetry/${id}?drivers=${selectedDrivers.join(",")}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTelemetry(data.data);
        }
      });
  }, [id, selectedDrivers]);

  const toggleDriver = (driverId: number | string) => {
    const id = String(driverId);
    setSelectedDrivers((prev) => {
      const prevStr = prev.map(String);
      if (prevStr.includes(id)) {
        return prev.filter((d) => String(d) !== id);
      }
      if (prev.length >= 4) {
        return prev; // Max 4 drivers
      }
      return [...prev, driverId];
    });
  };

  // Transform telemetry data for charts
  const chartData = telemetry.length > 0
    ? telemetry[0].distance_m.map((dist, i) => {
        const point: Record<string, number> = { distance: Math.round(dist) };
        telemetry.forEach((t) => {
          point[`speed_${t.driver_code}`] = t.speed_kph?.[i] ?? 0;
          point[`throttle_${t.driver_code}`] = t.throttle?.[i] ?? 0;
          point[`brake_${t.driver_code}`] = t.brake?.[i] ?? 0;
          point[`gear_${t.driver_code}`] = t.gear?.[i] ?? 0;
        });
        return point;
      })
    : [];

  // Calculate speed delta (first driver as reference)
  const deltaData = telemetry.length >= 2
    ? telemetry[0].distance_m.map((dist, i) => {
        const ref = telemetry[0].speed_kph?.[i] ?? 0;
        const point: Record<string, number> = { distance: Math.round(dist) };
        telemetry.slice(1).forEach((t) => {
          const speed = t.speed_kph?.[i] ?? 0;
          point[`delta_${t.driver_code}`] = speed - ref;
        });
        return point;
      })
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-f1-black flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-2 border-f1-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-f1-black">
      {/* Header */}
      <header className="border-b border-f1-gray/30 bg-f1-dark/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-f1-light hover:text-f1-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-f1-red rounded-full" />
              <h1 className="text-2xl font-bold tracking-tight">
                F1<span className="text-f1-red">Pro</span>
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
        {/* Driver Selection */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-f1-light uppercase tracking-wider mb-3">
            Compare Drivers (select up to 4)
          </h2>
          <div className="flex flex-wrap gap-2">
            {drivers.map((d) => {
              const isSelected = selectedDrivers.map(String).includes(String(d.driver_id));
              const color = getDriverColor(d.driver_code);
              return (
                <button
                  key={d.driver_id}
                  onClick={() => toggleDriver(d.driver_id)}
                  className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all border ${
                    isSelected
                      ? "text-white shadow-lg"
                      : "bg-f1-dark border-f1-gray/30 text-f1-light hover:border-f1-gray/50"
                  }`}
                  style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                >
                  <span className="font-mono">{d.driver_code}</span>
                  {d.position && <span className="ml-2 opacity-70">P{d.position}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart Type Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "speed", label: "Speed Trace" },
            { key: "throttle", label: "Throttle & Brake" },
            { key: "gear", label: "Gear" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveChart(tab.key as typeof activeChart)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeChart === tab.key
                  ? "bg-f1-red text-white"
                  : "bg-f1-dark border border-f1-gray/30 text-f1-light hover:text-f1-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {telemetry.length > 0 ? (
          <div className="grid grid-cols-12 gap-4">
            {/* Charts Column */}
            <div className="col-span-8 space-y-4">
              {/* Main Chart */}
              <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
                <h3 className="text-sm font-semibold text-f1-light uppercase tracking-wider mb-4">
                  {activeChart === "speed" && "Speed (km/h) vs Distance"}
                  {activeChart === "throttle" && "Throttle & Brake (%) vs Distance"}
                  {activeChart === "gear" && "Gear vs Distance"}
                </h3>
                <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    onMouseMove={(e: any) => {
                      if (e?.activePayload) {
                        setHoveredDistance(e.activePayload[0]?.payload?.distance);
                      }
                    }}
                    onMouseLeave={() => setHoveredDistance(null)}
                  >
                    <XAxis
                      dataKey="distance"
                      stroke="#9ca3af"
                      fontSize={11}
                      tickFormatter={(v) => `${(v / 1000).toFixed(1)}km`}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={11}
                      domain={activeChart === "gear" ? [0, 8] : activeChart === "throttle" ? [0, 100] : ["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f1f27",
                        border: "1px solid #38383f",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelFormatter={(v) => `Distance: ${(Number(v) / 1000).toFixed(2)} km`}
                    />
                    {hoveredDistance && (
                      <ReferenceLine x={hoveredDistance} stroke="#e10600" strokeDasharray="3 3" />
                    )}
                    {telemetry.map((t) => {
                      const color = getDriverColor(t.driver_code);
                      if (activeChart === "speed") {
                        return (
                          <Line
                            key={t.driver_code}
                            type="monotone"
                            dataKey={`speed_${t.driver_code}`}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            name={t.driver_code}
                          />
                        );
                      }
                      if (activeChart === "throttle") {
                        return (
                          <Line
                            key={`throttle_${t.driver_code}`}
                            type="monotone"
                            dataKey={`throttle_${t.driver_code}`}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            name={`${t.driver_code} Throttle`}
                          />
                        );
                      }
                      if (activeChart === "gear") {
                        return (
                          <Line
                            key={t.driver_code}
                            type="stepAfter"
                            dataKey={`gear_${t.driver_code}`}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            name={t.driver_code}
                          />
                        );
                      }
                      return null;
                    })}
                    {activeChart === "throttle" &&
                      telemetry.map((t) => (
                        <Line
                          key={`brake_${t.driver_code}`}
                          type="monotone"
                          dataKey={`brake_${t.driver_code}`}
                          stroke={getDriverColor(t.driver_code)}
                          strokeWidth={2}
                          strokeDasharray="4 2"
                          dot={false}
                          name={`${t.driver_code} Brake`}
                          opacity={0.6}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

              {/* Speed Delta Chart (if 2+ drivers) */}
              {telemetry.length >= 2 && activeChart === "speed" && (
                <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
                  <h3 className="text-sm font-semibold text-f1-light uppercase tracking-wider mb-4">
                    Speed Delta vs {telemetry[0].driver_code} (km/h)
                  </h3>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={deltaData}>
                        <XAxis
                          dataKey="distance"
                          stroke="#9ca3af"
                          fontSize={11}
                          tickFormatter={(v) => `${(v / 1000).toFixed(1)}km`}
                        />
                        <YAxis stroke="#9ca3af" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f1f27",
                            border: "1px solid #38383f",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <ReferenceLine y={0} stroke="#38383f" />
                        {telemetry.slice(1).map((t) => (
                          <Line
                            key={t.driver_code}
                            type="monotone"
                            dataKey={`delta_${t.driver_code}`}
                            stroke={getDriverColor(t.driver_code)}
                            strokeWidth={2}
                            dot={false}
                            name={`${t.driver_code} vs ${telemetry[0].driver_code}`}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap gap-4 justify-center">
                {telemetry.map((t) => (
                  <div key={t.driver_code} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: getDriverColor(t.driver_code) }}
                    />
                    <span className="text-sm font-semibold">{t.driver_code}</span>
                    <span className="text-sm text-f1-light">Lap {t.lap_number}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Track Map Column */}
            <div className="col-span-4 space-y-4">
              {/* Track Map Color Mode */}
              <div className="flex gap-2">
                {[
                  { key: "speed", label: "Speed" },
                  { key: "throttle", label: "Throttle" },
                  { key: "brake", label: "Brake" },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => setTrackColorMode(mode.key as typeof trackColorMode)}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                      trackColorMode === mode.key
                        ? "bg-f1-red text-white"
                        : "bg-f1-dark border border-f1-gray/30 text-f1-light hover:text-f1-white"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Track Map */}
              {telemetry[0]?.pos_x && telemetry[0]?.pos_y && (
                <TrackMap
                  posX={telemetry[0].pos_x}
                  posY={telemetry[0].pos_y}
                  speed={telemetry[0].speed_kph}
                  throttle={telemetry[0].throttle}
                  brake={telemetry[0].brake}
                  hoveredIndex={hoveredIndex}
                  onHover={(index) => {
                    setHoveredIndex(index);
                    if (index !== null && telemetry[0]?.distance_m) {
                      setHoveredDistance(telemetry[0].distance_m[index]);
                    } else {
                      setHoveredDistance(null);
                    }
                  }}
                  colorMode={trackColorMode}
                  width={380}
                  height={380}
                />
              )}

              {/* Driver for track display */}
              <div className="text-center text-sm text-f1-light">
                Track: {telemetry[0]?.driver_code} - Lap {telemetry[0]?.lap_number}
              </div>
            </div>
          </div>
        ) : selectedDrivers.length > 0 ? (
          <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-12 text-center">
            <p className="text-f1-light">No telemetry data available for selected drivers</p>
          </div>
        ) : (
          <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-12 text-center">
            <p className="text-f1-light">Select drivers to compare telemetry</p>
          </div>
        )}
      </div>
    </div>
  );
}


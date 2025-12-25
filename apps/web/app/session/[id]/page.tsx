"use client";

import { use, useState, useEffect, useMemo, useCallback, useRef, useTransition } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  type TooltipProps,
} from "recharts";
import TrackMap from "@/app/components/TrackMap";
import { getDriverColor as getDriverColorBySeason } from "@/lib/driver-colors";
import { SiteBrand } from "@/components/SiteBrand";

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

function getDriverColor(code: string, season?: number): string {
  return getDriverColorBySeason(code, season || 2024);
}

// uniform downsample indices; keeps endpoints; avoids duplicates
function downsampleIndices(n: number, maxPoints: number): number[] {
  if (n <= maxPoints) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (maxPoints - 1);
  const raw = Array.from({ length: maxPoints }, (_, i) => Math.round(i * step));
  const out: number[] = [];
  let last = -1;
  for (const idx of raw) {
    if (idx !== last) out.push(idx);
    last = idx;
  }
  return out;
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<(number | string)[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([]);
  const [loading, setLoading] = useState(true);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeChart, setActiveChart] = useState<"speed" | "throttle" | "gear">("speed");
  const [trackColorMode, setTrackColorMode] = useState<"speed" | "throttle" | "brake">("speed");

  const [isPending, startTransition] = useTransition();

  // Cache telemetry per driver_id for the current session id
  const telemetryCacheRef = useRef<Map<string, TelemetryData>>(new Map());

  // Tracks which driver codes have animated already
  const renderedDriverCodesRef = useRef<Set<string>>(new Set());

  const sessionAbortRef = useRef<AbortController | null>(null);
  const telemetryAbortRef = useRef<AbortController | null>(null);

  // Reset hover when switching chart tabs
  useEffect(() => {
    setHoveredIndex(null);
    renderedDriverCodesRef.current = new Set();
  }, [activeChart]);

  // Hover updates throttled w/ RAF to reduce re-renders on mousemove
  const rafRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<number | null>(null);

  const handleHoverByIndex = useCallback((index: number | null) => {
    pendingHoverRef.current = index;
    if (rafRef.current != null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setHoveredIndex(pendingHoverRef.current);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Fetch session info + driver list (combined with reset logic)
  useEffect(() => {
    // Guard against undefined id
    if (!id) return;

    // Reset all state for new session
    telemetryCacheRef.current = new Map();
    renderedDriverCodesRef.current = new Set();
    setTelemetry([]);
    setSelectedDrivers([]);
    setSession(null);
    setLoading(true);

    sessionAbortRef.current?.abort();
    const ac = new AbortController();
    sessionAbortRef.current = ac;

    fetch(`/api/session/${id}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) {
          setDrivers([]);
          setLoading(false);
          return;
        }

        setSession(data.data.session);

        const driverOptions: DriverOption[] = (data.data.results ?? []).map((r: DriverOption) => ({
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

        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setDrivers([]);
        setLoading(false);
      });

    return () => ac.abort();
  }, [id]);

  const getTelemetryFromCache = useCallback((selected: (number | string)[]) => {
    const out: TelemetryData[] = [];
    for (const driverId of selected) {
      const t = telemetryCacheRef.current.get(String(driverId));
      if (t) out.push(t);
    }
    return out;
  }, []);

  // Fetch telemetry only for missing drivers (no UI loading indicator)
  useEffect(() => {
    if (selectedDrivers.length === 0) {
      setTelemetry([]);
      return;
    }

    // paint from cache immediately
    const cached = getTelemetryFromCache(selectedDrivers);
    if (cached.length > 0) setTelemetry(cached);

    // fetch missing only
    const missing = selectedDrivers.filter((d) => !telemetryCacheRef.current.has(String(d)));
    if (missing.length === 0) return;

    telemetryAbortRef.current?.abort();
    const ac = new AbortController();
    telemetryAbortRef.current = ac;

    fetch(`/api/telemetry/${id}?drivers=${missing.join(",")}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) return;

        const incoming: TelemetryData[] = data.data ?? [];

        for (const t of incoming) {
          telemetryCacheRef.current.set(String(t.driver_id), t);
        }

        startTransition(() => {
          setTelemetry(getTelemetryFromCache(selectedDrivers));
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
      });

    return () => ac.abort();
  }, [id, selectedDrivers, getTelemetryFromCache, startTransition]);

  const toggleDriver = useCallback(
    (driverId: number | string) => {
      const idStr = String(driverId);

      startTransition(() => {
        setSelectedDrivers((prev) => {
          const prevStr = prev.map(String);

          // remove
          if (prevStr.includes(idStr)) {
            return prev.filter((d) => String(d) !== idStr);
          }

          // add (max 4)
          if (prev.length >= 4) return prev;
          return [...prev, driverId];
        });
      });
    },
    [startTransition]
  );

  // Tooltip formatters (typed; fixes TS formatter errors)
  const baseTooltipFormatter: TooltipProps<number, string>["formatter"] = (value, name) => {
    return [Math.round(Number(value ?? 0)), name ?? ""];
  };

  const deltaTooltipFormatter: TooltipProps<number, string>["formatter"] = (value, name) => {
    const v = Number(value ?? 0);
    return [`${v > 0 ? "+" : ""}${Math.round(v)} km/h`, name ?? ""];
  };

  // Sampling indices computed once per base length
  const sampleIdx = useMemo(() => {
    const base = telemetry[0];
    const n = base?.distance_m?.length ?? 0;
    if (!n) return [];
    return downsampleIndices(n, 500);
  }, [telemetry]);

  const chartData = useMemo(() => {
    if (telemetry.length === 0 || sampleIdx.length === 0) return [];

    const base = telemetry[0];

    return sampleIdx.map((origIndex) => {
      const point: Record<string, number> = {
        distance: Math.round(Number(base.distance_m?.[origIndex] ?? 0)),
      };

      for (const t of telemetry) {
        const code = t.driver_code;
        point[`speed_${code}`] = Number(t.speed_kph?.[origIndex] ?? 0);
        point[`throttle_${code}`] = Number(t.throttle?.[origIndex] ?? 0);
        point[`brake_${code}`] = Number(t.brake?.[origIndex] ?? 0);
        point[`gear_${code}`] = Number(t.gear?.[origIndex] ?? 0);
      }

      return point;
    });
  }, [telemetry, sampleIdx]);

  const deltaData = useMemo(() => {
    if (telemetry.length < 2 || sampleIdx.length === 0) return [];

    const refDriver = telemetry[0];

    return sampleIdx.map((origIndex) => {
      const dist = Math.round(Number(refDriver.distance_m?.[origIndex] ?? 0));
      const ref = Number(refDriver.speed_kph?.[origIndex] ?? 0);

      const point: Record<string, number> = { distance: dist };

      for (const t of telemetry.slice(1)) {
        point[`delta_${t.driver_code}`] = Number(t.speed_kph?.[origIndex] ?? 0) - ref;
      }

      return point;
    });
  }, [telemetry, sampleIdx]);

  const hoveredDistance = useMemo(() => {
    if (hoveredIndex == null || chartData.length === 0) return null;
    return chartData[hoveredIndex]?.distance ?? null;
  }, [hoveredIndex, chartData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-f1-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-3 border-f1-red border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-f1-light">Loading session data...</p>
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
            <Link href="/" className="p-2 rounded-lg text-f1-light hover:text-white hover:bg-f1-gray/30 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <SiteBrand />
          </div>

          {session && (
            <div className="text-right">
              <p className="text-white font-semibold">{session.weekend_name}</p>
              <p className="text-gray-400 text-sm">
                {session.session_code} - {session.circuit}
              </p>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Driver Selection */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
            Compare Drivers (select up to 4)
          </h2>
          {drivers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {drivers.map((d) => {
                const isSelected = selectedDrivers.map(String).includes(String(d.driver_id));
                const color = getDriverColor(d.driver_code, session?.season);

                return (
                  <button
                    key={d.driver_id}
                    onClick={() => toggleDriver(d.driver_id)}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all border-2 ${
                      isSelected
                        ? "text-white shadow-lg"
                        : "bg-f1-dark/50 border-f1-gray/30 text-gray-300 hover:border-f1-gray/50 hover:bg-f1-dark"
                    }`}
                    style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <span className="font-mono font-bold">{d.driver_code}</span>
                    {d.position != null && <span className="ml-2 opacity-70">P{d.position}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No driver data available for this session</p>
          )}
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
                  ? "bg-f1-red text-white shadow-lg"
                  : "bg-f1-dark/50 border border-f1-gray/30 text-gray-400 hover:text-white hover:bg-f1-dark"
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
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  {activeChart === "speed" && "Speed (km/h) vs Distance"}
                  {activeChart === "throttle" && "Throttle & Brake (%) vs Distance"}
                  {activeChart === "gear" && "Gear vs Distance"}
                </h3>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    {/* ✅ KEY forces remount/redraw on tab switch */}
                    <LineChart
                      key={`main-${activeChart}`}
                      data={chartData}
                      onMouseMove={(e: any) => handleHoverByIndex(e?.activeTooltipIndex ?? null)}
                      onMouseLeave={() => handleHoverByIndex(null)}
                    >
                      <XAxis
                        dataKey="distance"
                        stroke="#6b7280"
                        fontSize={11}
                        tickFormatter={(v) => `${(Number(v) / 1000).toFixed(1)}km`}
                      />
                      <YAxis
                        stroke="#6b7280"
                        fontSize={11}
                        domain={
                          activeChart === "gear"
                            ? [0, 8]
                            : activeChart === "throttle"
                            ? [0, 100]
                            : ["auto", "auto"]
                        }
                      />

                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f1f27",
                          border: "1px solid #38383f",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        labelFormatter={(v) => `${(Number(v) / 1000).toFixed(2)} km`}
                        formatter={baseTooltipFormatter}
                      />

                      {hoveredDistance != null && (
                        <ReferenceLine x={hoveredDistance} stroke="#e10600" strokeDasharray="3 3" strokeWidth={2} />
                      )}

                      {telemetry.map((t) => {
                        const color = getDriverColor(t.driver_code, session?.season);
                        const alreadyRendered = renderedDriverCodesRef.current.has(String(t.driver_code));

                        if (activeChart === "speed") {
                          return (
                            <Line
                              key={`speed_${t.driver_code}`}
                              type="monotone"
                              dataKey={`speed_${t.driver_code}`}
                              stroke={color}
                              strokeWidth={2}
                              dot={false}
                              name={t.driver_code}
                              isAnimationActive={!alreadyRendered && !isPending}
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
                              isAnimationActive={!alreadyRendered && !isPending}
                            />
                          );
                        }

                        if (activeChart === "gear") {
                          return (
                            <Line
                              key={`gear_${t.driver_code}`}
                              type="stepAfter"
                              dataKey={`gear_${t.driver_code}`}
                              stroke={color}
                              strokeWidth={2}
                              dot={false}
                              name={t.driver_code}
                              isAnimationActive={!alreadyRendered && !isPending}
                            />
                          );
                        }

                        return null;
                      })}

                      {activeChart === "throttle" &&
                        telemetry.map((t) => {
                          const alreadyRendered = renderedDriverCodesRef.current.has(String(t.driver_code));
                          return (
                            <Line
                              key={`brake_${t.driver_code}`}
                              type="monotone"
                              dataKey={`brake_${t.driver_code}`}
                              stroke={getDriverColor(t.driver_code, session?.season)}
                              strokeWidth={2}
                              strokeDasharray="4 2"
                              dot={false}
                              name={`${t.driver_code} Brake`}
                              opacity={0.6}
                              isAnimationActive={!alreadyRendered && !isPending}
                            />
                          );
                        })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Speed Delta Chart */}
              {telemetry.length >= 2 && activeChart === "speed" && (
                <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                    Speed Delta vs {telemetry[0].driver_code} (km/h)
                  </h3>

                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      {/* ✅ KEY forces remount/redraw on tab switch (even though only renders on speed) */}
                      <LineChart
                        key={`delta-${activeChart}`}
                        data={deltaData}
                        onMouseMove={(e: any) => handleHoverByIndex(e?.activeTooltipIndex ?? null)}
                        onMouseLeave={() => handleHoverByIndex(null)}
                      >
                        <XAxis
                          dataKey="distance"
                          stroke="#6b7280"
                          fontSize={11}
                          tickFormatter={(v) => `${(Number(v) / 1000).toFixed(1)}km`}
                        />
                        <YAxis stroke="#6b7280" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f1f27",
                            border: "1px solid #38383f",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={deltaTooltipFormatter}
                        />
                        <ReferenceLine y={0} stroke="#38383f" />
                        {hoveredDistance != null && (
                          <ReferenceLine x={hoveredDistance} stroke="#e10600" strokeDasharray="3 3" strokeWidth={2} />
                        )}

                        {telemetry.slice(1).map((t) => {
                          const alreadyRendered = renderedDriverCodesRef.current.has(String(t.driver_code));
                          return (
                            <Line
                              key={`delta_${t.driver_code}`}
                              type="monotone"
                              dataKey={`delta_${t.driver_code}`}
                              stroke={getDriverColor(t.driver_code, session?.season)}
                              strokeWidth={2}
                              dot={false}
                              name={`${t.driver_code} vs ${telemetry[0].driver_code}`}
                              isAnimationActive={!alreadyRendered && !isPending}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap gap-4 justify-center py-2">
                {telemetry.map((t) => (
                  <div key={t.driver_code} className="flex items-center gap-2 bg-f1-dark/30 px-3 py-1.5 rounded-lg">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: getDriverColor(t.driver_code, session?.season) }}
                    />
                    <span className="text-sm font-bold text-white">{t.driver_code}</span>
                    <span className="text-sm text-gray-400">Lap {t.lap_number}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Track Map Column */}
            <div className="col-span-4 space-y-4">
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
                        : "bg-f1-dark/50 border border-f1-gray/30 text-gray-400 hover:text-white"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {telemetry[0]?.pos_x && telemetry[0]?.pos_y && (
                <TrackMap
                  posX={telemetry[0].pos_x}
                  posY={telemetry[0].pos_y}
                  speed={telemetry[0].speed_kph}
                  throttle={telemetry[0].throttle}
                  brake={telemetry[0].brake}
                  hoveredIndex={hoveredIndex}
                  onHover={handleHoverByIndex}
                  colorMode={trackColorMode}
                  width={380}
                  height={380}
                />
              )}

              <div className="text-center text-sm text-gray-400 bg-f1-dark/30 rounded-lg py-2">
                Track: <span className="font-bold text-white">{telemetry[0]?.driver_code}</span> - Lap{" "}
                {telemetry[0]?.lap_number}
              </div>
            </div>
          </div>
        ) : selectedDrivers.length > 0 ? (
          <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-12 text-center">
            <p className="text-gray-400">No telemetry data available for selected drivers</p>
          </div>
        ) : (
          <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-12 text-center">
            <p className="text-gray-400">Select drivers to compare telemetry</p>
          </div>
        )}
      </div>
    </div>
  );
}

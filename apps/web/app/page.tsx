"use client";

import { useState, useEffect } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { AdminLogin } from "@/components/AdminLogin";
import Link from "next/link";

interface Weekend {
  id: number;
  season: number;
  round: number;
  name: string;
  circuit: string;
  date: string;
  sessions: { code: string; id: number }[];
}

interface SessionResult {
  driver_id: number;
  driver_code: string;
  driver_name: string;
  position: number | null;
  best_lap_time_ms: number | null;
  status: string | null;
  points: number | null;
  grid: number | null;
}

interface SessionData {
  session: {
    id: number;
    session_code: string;
    weekend_name: string;
    circuit: string;
    season: number;
    round: number;
  };
  results: SessionResult[];
}

const SESSION_LABELS: Record<string, string> = {
  FP1: "Practice 1",
  FP2: "Practice 2", 
  FP3: "Practice 3",
  Q: "Qualifying",
  SQ: "Sprint Quali",
  S: "Sprint",
  R: "Race",
};

const SESSION_COLORS: Record<string, string> = {
  FP1: "bg-blue-600",
  FP2: "bg-blue-500",
  FP3: "bg-blue-400",
  Q: "bg-purple-500",
  SQ: "bg-orange-500",
  S: "bg-orange-400",
  R: "bg-f1-red",
};

function formatLapTime(ms: number | null): string {
  if (!ms) return "-";
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3);
  return minutes > 0 ? `${minutes}:${seconds.padStart(6, "0")}` : seconds;
}

function formatDelta(ms: number | null, leaderMs: number | null): string {
  if (!ms || !leaderMs) return "";
  if (ms === leaderMs) return "";
  const delta = (ms - leaderMs) / 1000;
  return `+${delta.toFixed(3)}`;
}

export default function Home() {
  const { isAdmin, adminToken } = useAdmin();
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [weekends, setWeekends] = useState<Weekend[]>([]);
  const [selectedWeekend, setSelectedWeekend] = useState<Weekend | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestJobId, setIngestJobId] = useState<number | null>(null);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [sessionProgress, setSessionProgress] = useState<Record<string, number>>({});
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<string[]>(["Q", "R"]);

  // Fetch seasons on mount
  useEffect(() => {
    fetch("/api/seasons")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSeasons(data.data);
          if (data.data.length > 0) {
            setSelectedSeason(data.data[0]);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Fetch weekends when season changes
  useEffect(() => {
    if (!selectedSeason) return;
    
    setLoading(true);
    fetch(`/api/weekends?season=${selectedSeason}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setWeekends(data.data);
          if (data.data.length > 0) {
            setSelectedWeekend(data.data[0]);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedSeason]);

  // Fetch session data when session changes
  useEffect(() => {
    if (!selectedSessionId) {
      setSessionData(null);
      return;
    }
    
    setLoading(true);
    fetch(`/api/session/${selectedSessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSessionData(data.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedSessionId]);

  // Auto-select first session when weekend changes and check available sessions
  useEffect(() => {
    if (selectedWeekend && selectedWeekend.sessions.length > 0) {
      setSelectedSessionId(selectedWeekend.sessions[0].id);
    } else {
      setSelectedSessionId(null);
    }
    
    // Check which sessions are available for this weekend
    if (selectedWeekend && selectedSeason) {
      fetch(`/api/weekend-sessions?season=${selectedSeason}&round=${selectedWeekend.round}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAvailableSessions(data.sessions);
          }
        })
        .catch(() => {
          // Default to Q and R if API fails
          setAvailableSessions(["Q", "R"]);
        });
    }
  }, [selectedWeekend, selectedSeason]);

  const leaderTime = sessionData?.results[0]?.best_lap_time_ms ?? null;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSessionSelector && !(event.target as Element).closest('.session-selector')) {
        setShowSessionSelector(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSessionSelector]);

  // Load data for a weekend
  const loadWeekendData = async (specificSessions?: string[]) => {
    if (!selectedWeekend || !selectedSeason) return;
    
    setIngesting(true);
    setIngestStatus("Starting data download...");
    
    // Use specific sessions if provided, otherwise load all available sessions
    const sessionsToLoad = specificSessions || availableSessions;
    
    try {
      // Include admin token if available
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (adminToken) {
        headers["Authorization"] = `Bearer ${adminToken}`;
      }
      
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers,
        body: JSON.stringify({
          season: selectedSeason,
          round: selectedWeekend.round,
          sessions: sessionsToLoad
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.message === "All requested sessions already exist") {
          setIngestStatus("Data already loaded!");
          setTimeout(() => {
            setIngesting(false);
            setIngestStatus(null);
            // Refresh weekend data
            window.location.reload();
          }, 1000);
        } else {
          setIngestJobId(data.jobId);
          setIngestStatus(`Preparing to load ${data.sessions.length} sessions...`);
          
          // Initialize progress for each session
          const initialProgress: Record<string, number> = {};
          data.sessions.forEach((session: string) => {
            initialProgress[session] = 0;
          });
          setSessionProgress(initialProgress);
          
          // Poll for job status and progress
          const pollInterval = setInterval(async () => {
            const statusRes = await fetch(`/api/ingest?jobId=${data.jobId}`);
            const statusData = await statusRes.json();
            
            if (statusData.success && statusData.job) {
              const job = statusData.job;
              
              if (job.status === "SUCCESS") {
                // Set all sessions to 100%
                const completedProgress: Record<string, number> = {};
                data.sessions.forEach((session: string) => {
                  completedProgress[session] = 100;
                });
                setSessionProgress(completedProgress);
                setIngestStatus("Data loaded successfully!");
                clearInterval(pollInterval);
                setTimeout(() => {
                  setIngesting(false);
                  setIngestStatus(null);
                  setIngestJobId(null);
                  setSessionProgress({});
                  // Refresh weekend data
                  window.location.reload();
                }, 1000);
              } else if (job.status === "FAILED") {
                setIngestStatus(`Failed: ${job.error || "Unknown error"}`);
                clearInterval(pollInterval);
                setTimeout(() => {
                  setIngesting(false);
                  setIngestStatus(null);
                  setIngestJobId(null);
                  setSessionProgress({});
                }, 3000);
              } else if (job.status === "RUNNING") {
                setIngestStatus(`Loading data...`);
                
                // Use real progress if available, otherwise simulate
                if (job.progress) {
                  setSessionProgress(job.progress);
                } else {
                  // Simulate progress
                  const elapsed = Date.now() - new Date(job.started_at).getTime();
                  const estimatedTimePerSession = 90000; // 90 seconds per session
                  const totalSessions = data.sessions.length;
                  const overallProgress = Math.min((elapsed / (estimatedTimePerSession * totalSessions)) * 100, 95);
                  
                  // Update individual session progress
                  const updatedProgress: Record<string, number> = {};
                  data.sessions.forEach((session: string, index: number) => {
                    const sessionStartProgress = (index / totalSessions) * 100;
                    const sessionEndProgress = ((index + 1) / totalSessions) * 100;
                    const sessionProgress = Math.max(0, Math.min(100, 
                      ((overallProgress - sessionStartProgress) / (sessionEndProgress - sessionStartProgress)) * 100
                    ));
                    updatedProgress[session] = Math.floor(sessionProgress);
                  });
                  setSessionProgress(updatedProgress);
                }
              }
            }
          }, 2000);
          
          // Stop polling after 10 minutes
          setTimeout(() => clearInterval(pollInterval), 600000);
        }
      } else {
        setIngestStatus(`Error: ${data.error}`);
        setTimeout(() => {
          setIngesting(false);
          setIngestStatus(null);
        }, 3000);
      }
    } catch (error) {
      setIngestStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      setTimeout(() => {
        setIngesting(false);
        setIngestStatus(null);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-f1-black">
      {/* Header */}
      <header className="border-b border-f1-gray/30 bg-f1-dark/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-f1-red rounded-full" />
            <h1 className="text-2xl font-bold tracking-tight">
              F1<span className="text-f1-red">Pro</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Season Selector */}
            <div className="flex items-center gap-2">
              <span className="text-f1-light text-sm">Season</span>
              <select
                value={selectedSeason ?? ""}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                className="bg-f1-dark border border-f1-gray/50 rounded-lg px-4 py-2 text-f1-white font-semibold focus:outline-none focus:border-f1-red transition-colors cursor-pointer"
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Admin Login */}
            <AdminLogin />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* GP Selector - Left Panel */}
          <aside className="col-span-3">
            <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-f1-gray/20">
                <h2 className="text-sm font-semibold text-f1-light uppercase tracking-wider">
                  Grand Prix
                </h2>
              </div>
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                {weekends.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWeekend(w)}
                    className={`w-full text-left px-4 py-3 border-b border-f1-gray/10 transition-all hover:bg-f1-gray/20 ${
                      selectedWeekend?.id === w.id
                        ? "bg-f1-red/10 border-l-2 border-l-f1-red"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-f1-light text-xs font-mono w-6">
                        R{w.round}
                      </span>
                      <div>
                        <p className="font-semibold text-sm">{w.name}</p>
                        <p className="text-xs text-f1-light">{w.circuit}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="col-span-9">
            {selectedWeekend && (
              <>
                {/* Weekend Header */}
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-f1-light text-sm mb-1">
                        <span>Round {selectedWeekend.round}</span>
                        <span>•</span>
                        <span>{selectedWeekend.circuit}</span>
                      </div>
                      <h2 className="text-3xl font-bold">{selectedWeekend.name}</h2>
                    </div>
                    
                    {/* Load Data Button - Only show for admin users */}
                    {selectedWeekend.sessions.length === 0 && isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadWeekendData()}
                          disabled={ingesting}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                            ingesting
                              ? "bg-f1-gray/50 text-f1-light cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          }`}
                        >
                          {ingesting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                              </svg>
                              Load All
                            </>
                          )}
                        </button>
                        
                        <div className="relative session-selector">
                          <button
                            onClick={() => setShowSessionSelector(!showSessionSelector)}
                            disabled={ingesting}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg font-semibold text-sm transition-all border ${
                              ingesting
                                ? "bg-f1-gray/50 text-f1-light cursor-not-allowed border-f1-gray/30"
                                : "bg-f1-dark border-f1-gray/30 text-f1-light hover:border-f1-gray/50 hover:text-f1-white"
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {/* Dropdown Menu */}
                          {showSessionSelector && !ingesting && (
                            <div className="absolute right-0 mt-2 w-48 bg-f1-dark border border-f1-gray/30 rounded-lg shadow-lg overflow-hidden z-10">
                              <div className="p-2 text-xs font-semibold text-f1-light uppercase tracking-wider border-b border-f1-gray/30">
                                Select Sessions
                              </div>
                              {[
                                { code: "Q", name: "Qualifying" },
                                { code: "R", name: "Race" },
                                { code: "S", name: "Sprint" },
                                { code: "SS", name: "Sprint Shootout" },
                              ].filter(session => availableSessions.includes(session.code)).map((session) => (
                                <button
                                  key={session.code}
                                  onClick={() => {
                                    loadWeekendData([session.code]);
                                    setShowSessionSelector(false);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-f1-gray/20 transition-colors"
                                >
                                  {session.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Ingest Status */}
                  {ingestStatus && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${
                      ingestStatus.includes("Error") || ingestStatus.includes("Failed")
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : ingestStatus.includes("successfully") || ingestStatus.includes("already")
                        ? "bg-green-500/20 text-green-300 border border-green-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}>
                      <div>{ingestStatus}</div>
                      
                      {/* Session Progress Bars */}
                      {Object.keys(sessionProgress).length > 0 && (
                        <div className="mt-3 space-y-2">
                          {Object.entries(sessionProgress).map(([session, progress]) => (
                            <div key={session} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-semibold">
                                  {session === "Q" ? "Qualifying" : 
                                   session === "R" ? "Race" :
                                   session === "S" ? "Sprint" :
                                   session === "SS" ? "Sprint Shootout" : session}
                                </span>
                                <span>{progress}%</span>
                              </div>
                              <div className="w-full bg-f1-gray/30 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-f1-red to-red-400 rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Session Tabs or No Data Message */}
                {selectedWeekend.sessions.length === 0 ? (
                  isAdmin ? (
                    <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-8 mb-6">
                      <h3 className="text-xl font-semibold mb-4">Available Sessions</h3>
                      <p className="text-f1-light mb-6">
                        Choose which sessions to download:
                      </p>
                    
                    {/* Session Download Options */}
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { code: "Q", name: "Qualifying", desc: "Grid positions and lap times", icon: "⏱️" },
                        { code: "R", name: "Race", desc: "Full race data with positions", icon: "🏁" },
                        { code: "S", name: "Sprint", desc: "Sprint race data", icon: "🏃" },
                        { code: "SS", name: "Sprint Shootout", desc: "Sprint qualifying", icon: "⚡" },
                      ].filter(session => availableSessions.includes(session.code)).map((session) => (
                        <div
                          key={session.code}
                          className="bg-f1-dark/50 rounded-lg border border-f1-gray/30 p-4 hover:border-f1-gray/50 transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{session.icon}</span>
                                <h4 className="font-semibold text-lg">{session.name}</h4>
                              </div>
                              <p className="text-sm text-f1-light mt-1">{session.desc}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => loadWeekendData([session.code])}
                            disabled={ingesting}
                            className={`w-full px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                              ingesting
                                ? "bg-f1-gray/50 text-f1-light cursor-not-allowed"
                                : "bg-f1-red hover:bg-red-600 text-white"
                            }`}
                          >
                            {ingesting ? "Loading..." : "Download"}
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-f1-gray/30">
                      <p className="text-sm text-f1-light/60 text-center">
                        Tip: Download only the sessions you need to save time and storage
                      </p>
                    </div>
                  </div>
                  ) : (
                    <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-8 mb-6">
                      <h3 className="text-xl font-semibold mb-4">No Data Available</h3>
                      <p className="text-f1-light">
                        Data for this Grand Prix weekend is not yet available.
                      </p>
                    </div>
                  )
                ) : (
                  <>
                    {/* Session Tabs */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex gap-2">
                        {selectedWeekend.sessions.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSessionId(s.id)}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                              selectedSessionId === s.id
                                ? `${SESSION_COLORS[s.code] || "bg-f1-gray"} text-white shadow-lg`
                                : "bg-f1-dark border border-f1-gray/30 text-f1-light hover:border-f1-gray/50 hover:text-f1-white"
                            }`}
                          >
                            {SESSION_LABELS[s.code] || s.code}
                          </button>
                        ))}
                        
                        {/* Download missing sessions button for admins */}
                        {isAdmin && (() => {
                          const loadedSessions = selectedWeekend.sessions.map(s => s.code);
                          const missingSessions = availableSessions.filter(code => !loadedSessions.includes(code));
                          
                          if (missingSessions.length > 0) {
                            return (
                              <div className="relative session-selector ml-2">
                                <button
                                  onClick={() => setShowSessionSelector(!showSessionSelector)}
                                  disabled={ingesting}
                                  className={`flex items-center gap-1 px-3 py-2 rounded-lg font-semibold text-sm transition-all border ${
                                    ingesting
                                      ? "bg-f1-gray/50 text-f1-light cursor-not-allowed border-f1-gray/30"
                                      : "bg-green-600 border-green-700 text-white hover:bg-green-700"
                                  }`}
                                  title="Download missing sessions"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Load More
                                </button>
                                
                                {/* Dropdown Menu */}
                                {showSessionSelector && !ingesting && (
                                  <div className="absolute right-0 mt-2 w-48 bg-f1-dark border border-f1-gray/30 rounded-lg shadow-lg overflow-hidden z-10">
                                    <div className="p-2 text-xs font-semibold text-f1-light uppercase tracking-wider border-b border-f1-gray/30">
                                      Missing Sessions
                                    </div>
                                    {missingSessions.map((sessionCode) => (
                                      <button
                                        key={sessionCode}
                                        onClick={() => {
                                          loadWeekendData([sessionCode]);
                                          setShowSessionSelector(false);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-f1-gray/20 transition-colors"
                                      >
                                        {SESSION_LABELS[sessionCode] || sessionCode}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                  {selectedSessionId && (
                    <div className="flex gap-2">
                      <Link
                        href={`/session/${selectedSessionId}`}
                        className="flex items-center gap-2 px-4 py-2 bg-f1-red hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        View Telemetry
                      </Link>
                      {sessionData?.session.session_code === "R" && (
                        <Link
                          href={`/race/${selectedSessionId}`}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          Race Analysis
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Results Table */}
                {loading ? (
                  <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-8 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-f1-red border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-f1-light">Loading session data...</p>
                  </div>
                ) : sessionData ? (
                  <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-f1-gray/30 text-f1-light text-xs uppercase tracking-wider">
                          <th className="text-left px-4 py-3 w-16">Pos</th>
                          <th className="text-left px-4 py-3">Driver</th>
                          <th className="text-right px-4 py-3 w-32">Time</th>
                          <th className="text-right px-4 py-3 w-24">Gap</th>
                          {sessionData.session.session_code === "R" && (
                            <>
                              <th className="text-right px-4 py-3 w-20">Grid</th>
                              <th className="text-right px-4 py-3 w-20">Pts</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {sessionData.results.map((r, i) => (
                          <tr
                            key={r.driver_id}
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
                                {r.position ?? "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-f1-red">
                                  {r.driver_code}
                                </span>
                                <span className="text-f1-light">
                                  {r.driver_name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold">
                              {sessionData.session.session_code === "R" && i === 0
                                ? formatLapTime(r.best_lap_time_ms)
                                : sessionData.session.session_code === "R"
                                ? "-"
                                : formatLapTime(r.best_lap_time_ms)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-f1-light text-sm">
                              {i === 0 
                                ? "" 
                                : sessionData.session.session_code === "R" && r.best_lap_time_ms
                                ? `+${(r.best_lap_time_ms / 1000).toFixed(3)}`
                                : formatDelta(r.best_lap_time_ms, leaderTime)}
                            </td>
                            {sessionData.session.session_code === "R" && (
                              <>
                                <td className="px-4 py-3 text-right font-mono text-f1-light">
                                  {r.grid ?? "-"}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-semibold text-green-400">
                                  {r.points ? `+${r.points}` : "-"}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-8 text-center">
                    <p className="text-f1-light">Select a session to view results</p>
                  </div>
                )}
                </>
              )}
              </>
            )}

            {!selectedWeekend && !loading && (
              <div className="bg-f1-dark/50 rounded-xl border border-f1-gray/20 p-12 text-center">
                <div className="text-6xl mb-4"></div>
                <h3 className="text-xl font-semibold mb-2">No Data Available</h3>
                <p className="text-f1-light">
                  Run the ingest script to load F1 session data.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

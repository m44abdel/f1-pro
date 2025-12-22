'use client';

import { useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';

export function SqlQueryPanel() {
  const { isAdmin } = useAdmin();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  if (!isAdmin) return null;

  const handleExecute = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setResults(null);
    
    try {
      const response = await fetch('/api/admin/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data);
      } else {
        setError(data.error || 'Query failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  // Example queries
  const exampleQueries = [
    { label: 'Recent Sessions', query: 'SELECT w.name, s.session_code, s.start_time_utc\nFROM sessions s\nJOIN weekends w ON s.weekend_id = w.id\nORDER BY s.start_time_utc DESC\nLIMIT 10' },
    { label: 'Driver Standings', query: 'SELECT d.code, d.name, COUNT(sr.id) as races, SUM(CASE WHEN sr.position = 1 THEN 1 ELSE 0 END) as wins\nFROM drivers d\nJOIN session_results sr ON d.id = sr.driver_id\nJOIN sessions s ON sr.session_id = s.id\nWHERE s.session_code = \'R\'\nGROUP BY d.id, d.code, d.name\nORDER BY wins DESC' },
    { label: 'Fastest Laps', query: 'SELECT d.code, w.name, MIN(l.lap_time_ms) as fastest_lap_ms\nFROM laps l\nJOIN drivers d ON l.driver_id = d.id\nJOIN sessions s ON l.session_id = s.id\nJOIN weekends w ON s.weekend_id = w.id\nWHERE s.session_code = \'R\' AND l.lap_time_ms IS NOT NULL\nGROUP BY d.code, w.name\nORDER BY fastest_lap_ms\nLIMIT 20' },
  ];

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="fixed bottom-4 right-4 z-40 px-4 py-2 bg-f1-dark border border-f1-gray/30 rounded-lg hover:border-f1-gray/50 transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        SQL Query
      </button>

      {/* Query Panel */}
      {showPanel && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-f1-dark border-t border-f1-gray/30 shadow-2xl" style={{ height: '50vh' }}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-f1-gray/30">
              <h3 className="text-lg font-semibold">SQL Query Console</h3>
              <button
                onClick={() => setShowPanel(false)}
                className="p-1 hover:bg-f1-gray/20 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Query Editor */}
              <div className="flex-1 flex flex-col p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Query Editor</label>
                  <select
                    onChange={(e) => {
                      const example = exampleQueries.find(q => q.label === e.target.value);
                      if (example) setQuery(example.query);
                    }}
                    className="px-2 py-1 text-sm bg-f1-dark border border-f1-gray/30 rounded"
                  >
                    <option value="">Example Queries...</option>
                    {exampleQueries.map(q => (
                      <option key={q.label} value={q.label}>{q.label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter SQL query (SELECT only)..."
                  className="flex-1 p-3 bg-black/50 border border-f1-gray/30 rounded-lg font-mono text-sm focus:outline-none focus:border-f1-red resize-none"
                  spellCheck={false}
                />
                <button
                  onClick={handleExecute}
                  disabled={loading || !query.trim()}
                  className="mt-3 px-4 py-2 bg-f1-red hover:bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 self-start"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Execute
                    </>
                  )}
                </button>
              </div>

              {/* Results */}
              <div className="flex-1 flex flex-col p-4 border-l border-f1-gray/30">
                <h4 className="text-sm font-medium mb-2">Results</h4>
                <div className="flex-1 bg-black/50 border border-f1-gray/30 rounded-lg overflow-auto">
                  {error && (
                    <div className="p-4 text-red-400">
                      <div className="font-semibold mb-1">Error:</div>
                      <div className="font-mono text-sm">{error}</div>
                    </div>
                  )}
                  
                  {results && results.success && (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2 text-sm text-f1-light">
                        <span>{results.rowCount} rows</span>
                        <span>{results.duration}ms</span>
                      </div>
                      
                      {results.rows.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-f1-gray/30">
                                {Object.keys(results.rows[0]).map(key => (
                                  <th key={key} className="text-left p-2 font-medium">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {results.rows.map((row: any, i: number) => (
                                <tr key={i} className="border-b border-f1-gray/10 hover:bg-f1-gray/10">
                                  {Object.values(row).map((value: any, j) => (
                                    <td key={j} className="p-2 font-mono text-xs">
                                      {value === null ? 'NULL' : String(value)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-f1-light">No results</div>
                      )}
                    </div>
                  )}
                  
                  {!error && !results && (
                    <div className="p-4 text-f1-light/50">
                      Execute a query to see results
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

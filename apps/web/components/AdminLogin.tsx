'use client';

import { useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';

export function AdminLogin() {
  const { isAdmin, login, logout } = useAdmin();
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const success = await login(password);
    
    if (success) {
      setPassword('');
      setShowLogin(false);
    } else {
      setError('Invalid password');
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (isAdmin) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-green-400 font-medium">Admin Mode</span>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm bg-f1-dark border border-f1-gray/30 rounded-lg hover:border-f1-gray/50 transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowLogin(!showLogin)}
        className="p-2 rounded-lg bg-f1-red border-2 border-f1-red hover:bg-red-600 transition-all shadow-lg"
        title="Admin Login"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </button>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-f1-dark border border-f1-gray/30 rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Admin Login</h2>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-f1-dark border border-f1-gray/30 rounded-lg focus:outline-none focus:border-f1-red"
                  placeholder="Enter admin password"
                  autoFocus
                  required
                />
              </div>
              
              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="flex-1 px-4 py-2 bg-f1-red hover:bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(false);
                    setPassword('');
                    setError('');
                  }}
                  className="px-4 py-2 bg-f1-gray/20 hover:bg-f1-gray/30 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

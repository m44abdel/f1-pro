'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminContextType {
  isAdmin: boolean;
  adminToken: string | null;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  adminToken: null,
  login: async () => false,
  logout: async () => {},
  checkAuth: async () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/admin');
      const data = await response.json();
      
      if (data.success && data.isAdmin) {
        setIsAdmin(true);
        setAdminToken(data.token || null);
      } else {
        setIsAdmin(false);
        setAdminToken(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAdmin(false);
      setAdminToken(null);
    }
  };

  const login = async (password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsAdmin(true);
        setAdminToken(data.token || null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/admin', { method: 'DELETE' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    
    setIsAdmin(false);
    setAdminToken(null);
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, adminToken, login, logout, checkAuth }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from './types';
import { authApi } from './api';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(() => {
    // Try to restore from localStorage on initial load
    const stored = localStorage.getItem('kaizen_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const setCurrentUser = (user: User | null) => {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem('kaizen_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('kaizen_user');
    }
  };

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user } = await authApi.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        // If session check fails but we have stored user, keep them logged in
        // This handles the case where session cookies aren't working properly
        const stored = localStorage.getItem('kaizen_user');
        if (!stored) {
          setCurrentUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { user } = await authApi.login(email, password);
    setCurrentUser(user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // Ignore logout errors
    }
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      isLoading,
      login, 
      logout,
      setCurrentUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

// For backwards compatibility, export as useApp
export const useApp = useAuth;
export const AppProvider = AuthProvider;

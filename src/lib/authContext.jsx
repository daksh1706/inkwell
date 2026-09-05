import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const AuthContext = createContext(null);
const TOKEN_KEY = 'inkwell_auth_token';
const USER_KEY = 'inkwell_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem(TOKEN_KEY) || null;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin'); // 'signin' | 'signup'
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'saving' | 'error' | 'local'

  // Verify token on initial load
  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setIsLoading(false);
        setSyncStatus('local');
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          setSyncStatus('synced');
        } else {
          // Token expired or invalid
          logout(false);
        }
      } catch (err) {
        console.warn('Could not verify session with server, keeping cached user offline', err);
        setSyncStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, [token]);

  const openAuthModal = (mode = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const login = async (email, password) => {
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to sign in');
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setSyncStatus('synced');
      closeAuthModal();
      toast.success(`Welcome back, ${data.user.name}!`);
      return { success: true, workspace: data.workspace };
    } catch (err) {
      toast.error(err.message || 'Sign in failed');
      return { success: false, error: err.message };
    }
  };

  const signup = async (name, email, password, initialWorkspace) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, initialWorkspace }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create account');
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setSyncStatus('synced');
      closeAuthModal();
      toast.success(`Account created! Welcome, ${data.user.name}!`);
      return { success: true, workspace: data.workspace };
    } catch (err) {
      toast.error(err.message || 'Registration failed');
      return { success: false, error: err.message };
    }
  };

  const logout = (showToast = true) => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setSyncStatus('local');
    if (showToast) {
      toast.info('You have been signed out');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        authModalOpen,
        authModalMode,
        syncStatus,
        setSyncStatus,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUser, login as apiLogin, logout as apiLogout, setAuthErrorHandler, clearAuthToken } from '../services/authService';
import { useChatStore } from '../hooks/useChatStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle auth errors (session expired, invalid token)
  const handleAuthExpired = useCallback(() => {
    console.log('[AuthContext] Auth expired, clearing user state');
    clearAuthToken();
    setUser(null);
    useChatStore.getState().clearUserData();
  }, []);

  useEffect(() => {
    // Register the auth error handler so services can trigger logout
    setAuthErrorHandler(handleAuthExpired);

    // Check for existing session on mount
    getCurrentUser()
      .then(user => {
        setUser(user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [handleAuthExpired]);

  const login = async (username, password) => {
    // Clear any previous user's data before logging in as new user
    useChatStore.getState().clearUserData();
    const { user } = await apiLogin(username, password);
    setUser(user);
    return user;
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    // Clear all user-specific data from the store to ensure user isolation
    useChatStore.getState().clearUserData();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
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

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setTokenAccessor } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Wire token accessor for Axios interceptor
  useEffect(() => {
    setTokenAccessor(() => accessToken);
    if (accessToken) {
      localStorage.setItem('token', accessToken);
    } else {
      localStorage.removeItem('token');
    }
  }, [accessToken]);

  // Handle interceptor refresh events
  useEffect(() => {
    const handleTokenRefreshed = (e) => {
      setAccessToken(e.detail.token);
      if (e.detail.user) setUser(e.detail.user);
    };

    const handleSessionExpired = () => {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('token');
    };

    window.addEventListener('auth:token_refreshed', handleTokenRefreshed);
    window.addEventListener('auth:session_expired', handleSessionExpired);

    return () => {
      window.removeEventListener('auth:token_refreshed', handleTokenRefreshed);
      window.removeEventListener('auth:session_expired', handleSessionExpired);
    };
  }, []);

  // Check auth session on startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try refreshing or getting profile
        const res = await api.post('/auth/refresh');
        if (res.data?.success) {
          setUser(res.data.user);
          setAccessToken(res.data.accessToken);
        }
      } catch (err) {
        // If stored token exists, try /users/me
        if (accessToken) {
          try {
            const meRes = await api.get('/users/me');
            if (meRes.data?.success) {
              setUser(meRes.data.user);
            }
          } catch {
            setAccessToken(null);
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      setUser(res.data.user);
      setAccessToken(res.data.accessToken);
      return res.data;
    }
  };

  const register = async (username, email, password) => {
    const res = await api.post('/auth/register', { username, email, password });
    if (res.data.success) {
      setUser(res.data.user);
      setAccessToken(res.data.accessToken);
      return res.data;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('token');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        isAuthenticated: !!user && !!accessToken,
        login,
        register,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const AuthContext = createContext(null);

// Inactivity timeout in milliseconds (15 minutes)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef = useRef(null);
  const { enqueueSnackbar } = useSnackbar();

  // Handle logout
  const logout = useCallback((reason = 'manual') => {
    authService.logout();
    setUser(null);
    
    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    
    // Show appropriate message
    if (reason === 'inactivity') {
      enqueueSnackbar('You have been logged out due to inactivity', { 
        variant: 'warning',
        autoHideDuration: 5000
      });
    } else if (reason === 'token_expired') {
      enqueueSnackbar('Your session has expired. Please login again.', { 
        variant: 'info',
        autoHideDuration: 5000
      });
    }
  }, [enqueueSnackbar]);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Only set timer if user is logged in
    if (user) {
      // Update last activity timestamp
      localStorage.setItem('lastActivity', Date.now().toString());
      
      // Set new timer
      inactivityTimerRef.current = setTimeout(() => {
        logout('inactivity');
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, logout]);

  // Track user activity
  useEffect(() => {
    if (!user) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Start initial timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [user, resetInactivityTimer]);

  // Listen for auth:logout event from axios interceptor
  useEffect(() => {
    const handleAuthLogout = (event) => {
      logout(event.detail?.reason || 'token_expired');
    };

    window.addEventListener('auth:logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, [logout]);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const lastActivity = localStorage.getItem('lastActivity');
    
    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        
        // Check if session expired due to inactivity
        if (lastActivity) {
          const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
          if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
            // Session expired
            logout('inactivity');
            setLoading(false);
            return;
          }
        }
        
        setUser(userData);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('lastActivity');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await authService.login(username, password);
    const { token, user: userData } = response.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('lastActivity', Date.now().toString());
    setUser(userData);
    
    return response;
  };

  const value = {
    user,
    login,
    logout: () => logout('manual'),
    loading,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

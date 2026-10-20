import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { loadSession, saveSession, clearSession, setUnauthorizedHandler } from '../config/session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // 'loading' while we check the phone for a saved session, then either
  // 'signedIn' or 'signedOut'.
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);

  const signOut = useCallback(async () => {
    await clearSession();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const signIn = useCallback(async (token, signedInUser) => {
    await saveSession(token, signedInUser);
    setUser(signedInUser);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSession().then(session => {
      if (cancelled) return;
      if (session) {
        setUser(session.user);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

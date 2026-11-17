import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, clearSession, getSavedUser, saveSession, type User } from './api';
import { useEffect } from 'react';

type Credentials = { email: string; password: string };
type Registration = Credentials & { username: string; role: 'talent' | 'host' | 'pe_teacher'; institutionName?: string; district?: string };
type AuthContextValue = {
  user: User | null;
  signIn: (credentials: Credentials) => Promise<User>;
  signUp: (details: Registration) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getSavedUser());
  const [initialized, setInitialized] = useState(false);

  async function authenticate(endpoint: string, details: Credentials | Registration): Promise<User> {
    const result = await api<{ user: User; accessToken: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(details),
    });
    saveSession(result.user, result.accessToken);
    setUser(result.user);
    return result.user;
  }

  async function fetchCurrentUser() {
    try {
      const userData = await api<User>('/me');
      setUser(userData);
      return userData;
    } catch (requestError) {
      const sessionInvalid = requestError instanceof ApiError
        && ['AUTH_REQUIRED', 'INVALID_TOKEN', 'SESSION_EXPIRED'].includes(requestError.code ?? '');
      if (sessionInvalid) {
        setUser(null);
        clearSession();
      }
      throw requestError;
    }
  }

  useEffect(() => {
    if (initialized) return;
    if (user) {
      fetchCurrentUser().catch(() => {});
    }
    setInitialized(true);
  }, [initialized]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    signIn: (credentials) => authenticate('/login', credentials),
    signUp: async (details) => { await authenticate('/register', details); },
    signOut: async () => {
      try {
        await api('/logout', { method: 'POST' });
      } finally {
        clearSession();
        setUser(null);
      }
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}

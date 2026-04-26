import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  location: string;
  loading: boolean;
  sessionRemainingMs: number;
  login: (phaId: string, password: string) => Promise<string | null>;
  logout: () => void;
  selectStation: (location: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const SESSION_TIMEOUT = 60 * 60 * 1000;
const SESSION_STORAGE_KEY = 'ed-extemp-session';

function readSessionTimestamp(): number | null {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as { timestamp?: unknown };
    return typeof parsed.timestamp === 'number' ? parsed.timestamp : null;
  } catch {
    return null;
  }
}

function writeSession(user: User, location: string, timestamp = Date.now()) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ user, location, timestamp }));
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: Number(r.id),
    name: String(r.name ?? ''),
    pha_id: String(r.pha_id ?? ''),
    password: String(r.password ?? ''),
    role: (r.role as 'admin' | 'user') ?? 'user',
    active: r.active === true || r.active === 'TRUE',
    must_change_password: r.must_change_password === true || r.must_change_password === 'TRUE',
    profile_image: r.profile_image != null && r.profile_image !== '' ? String(r.profile_image) : undefined,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionRemainingMs, setSessionRemainingMs] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const { user: u, location: loc, timestamp } = JSON.parse(stored);

        if (timestamp && Date.now() - timestamp > SESSION_TIMEOUT) {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setLoading(false);
          return;
        }

        if (u) {
          setUser(u);
          setSessionRemainingMs(Math.max(SESSION_TIMEOUT - (Date.now() - Number(timestamp || Date.now())), 0));
          // Refresh user data from Firestore
          api.getUserById(u.id).then(({ data, error }) => {
            if (!error && data) {
              const freshUser = rowToUser(data);
              setUser(freshUser);
              writeSession(freshUser, loc || '', Number(timestamp || Date.now()));
            }
          });
        }
        if (loc) setLocation(loc);
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (phaId: string, password: string): Promise<string | null> => {
    const res = await api.login(phaId, password);
    if (res.error || !res.data) {
      return res.error ?? 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    }

    const u = rowToUser(res.data);
    setUser(u);
    setSessionRemainingMs(SESSION_TIMEOUT);
    writeSession(u, '');
    return null;
  };

  const selectStation = (loc: string) => {
    setLocation(loc);
    if (user) {
      const timestamp = readSessionTimestamp() ?? Date.now();
      writeSession(user, loc, timestamp);
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    const res = await api.getUserById(user.id);
    if (!res.error && res.data) {
      const u = rowToUser(res.data);
      setUser(u);
      const timestamp = readSessionTimestamp() ?? Date.now();
      writeSession(u, location, timestamp);
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    setLocation('');
    setSessionRemainingMs(0);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  // Activity monitor for session timeout (1 hour of inactivity)
  useEffect(() => {
    if (!user) {
      setSessionRemainingMs(0);
      return;
    }

    let lastUpdate = readSessionTimestamp() ?? Date.now();

    const syncRemaining = () => {
      const timestamp = readSessionTimestamp() ?? lastUpdate;
      lastUpdate = timestamp;
      const remaining = Math.max(SESSION_TIMEOUT - (Date.now() - timestamp), 0);
      setSessionRemainingMs(remaining);

      if (remaining <= 0) {
        logout();
      }
    };

    const updateActivity = () => {
      const now = Date.now();
      if (now - lastUpdate < 1000) return;

      lastUpdate = now;
      writeSession(user, location, now);
      setSessionRemainingMs(SESSION_TIMEOUT);
    };

    const handleUserActivity = () => updateActivity();

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    syncRemaining();
    const checkInterval = setInterval(syncRemaining, 1000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      clearInterval(checkInterval);
    };
  }, [user, location, logout]);

  return (
    <AuthContext.Provider value={{ user, location, loading, sessionRemainingMs, login, logout, selectStation, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

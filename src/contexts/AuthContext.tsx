import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  location: string;
  loading: boolean;
  login: (phaId: string, password: string) => Promise<string | null>;
  logout: () => void;
  selectStation: (location: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

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

  useEffect(() => {
    const stored = localStorage.getItem('ed-extemp-session');
    if (stored) {
      try {
        const { user: u, location: loc, timestamp } = JSON.parse(stored);

        const SESSION_TIMEOUT = 60 * 60 * 1000;
        if (timestamp && Date.now() - timestamp > SESSION_TIMEOUT) {
          localStorage.removeItem('ed-extemp-session');
          setLoading(false);
          return;
        }

        if (u) {
          setUser(u);
          // Refresh user data from GAS
          api.getUserById(u.id).then(({ data, error }) => {
            if (!error && data) {
              const freshUser = rowToUser(data);
              setUser(freshUser);
              localStorage.setItem('ed-extemp-session', JSON.stringify({ user: freshUser, location: loc || '', timestamp: Date.now() }));
            }
          });
        }
        if (loc) setLocation(loc);
      } catch {
        localStorage.removeItem('ed-extemp-session');
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
    localStorage.setItem('ed-extemp-session', JSON.stringify({ user: u, location: '', timestamp: Date.now() }));
    return null;
  };

  const selectStation = (loc: string) => {
    setLocation(loc);
    if (user) {
      localStorage.setItem('ed-extemp-session', JSON.stringify({ user, location: loc, timestamp: Date.now() }));
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    const res = await api.getUserById(user.id);
    if (!res.error && res.data) {
      const u = rowToUser(res.data);
      setUser(u);
      localStorage.setItem('ed-extemp-session', JSON.stringify({ user: u, location, timestamp: Date.now() }));
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    setLocation('');
    localStorage.removeItem('ed-extemp-session');
  }, []);

  // Activity monitor for session timeout (1 hour of inactivity)
  useEffect(() => {
    if (!user) return;

    let lastUpdate = Date.now();
    const SESSION_TIMEOUT = 60 * 60 * 1000;

    const updateActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 60000) {
        const sessionStr = localStorage.getItem('ed-extemp-session');
        if (sessionStr) {
          try {
            const session = JSON.parse(sessionStr);
            session.timestamp = now;
            localStorage.setItem('ed-extemp-session', JSON.stringify(session));
            lastUpdate = now;
          } catch (e) {
            console.error('Error updating session timestamp', e);
          }
        }
      }
    };

    const handleUserActivity = () => updateActivity();

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    const checkInterval = setInterval(() => {
      const sessionStr = localStorage.getItem('ed-extemp-session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          if (session.timestamp && Date.now() - session.timestamp > SESSION_TIMEOUT) {
            logout();
          }
        } catch (e) {}
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      clearInterval(checkInterval);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, location, loading, login, logout, selectStation, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

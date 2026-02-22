import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('ed-extemp-session');
    if (stored) {
      try {
        const { user: u, location: loc, timestamp } = JSON.parse(stored);
        
        const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
        if (timestamp && Date.now() - timestamp > SESSION_TIMEOUT) {
          localStorage.removeItem('ed-extemp-session');
          setLoading(false);
          return;
        }

        if (u) {
          setUser(u);
          // Refresh user data from Supabase to ensure latest profile_image
          supabase.from('users').select('*').eq('id', u.id).single().then(({ data, error }) => {
            if (!error && data) {
              const freshUser: User = {
                id: data.id,
                name: data.name,
                pha_id: data.pha_id,
                password: data.password,
                role: data.role,
                active: data.active,
                profile_image: data.profile_image || undefined,
                created_at: data.created_at,
              };
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('pha_id', phaId)
      .eq('password', password)
      .eq('active', true)
      .single();

    if (error || !data) {
      return 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    }

    const u: User = {
      id: data.id,
      name: data.name,
      pha_id: data.pha_id,
      password: data.password,
      role: data.role,
      active: data.active,
      must_change_password: data.must_change_password,
      profile_image: data.profile_image || undefined,
      created_at: data.created_at,
    };

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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    if (!error && data) {
      const u: User = {
        id: data.id,
        name: data.name,
        pha_id: data.pha_id,
        password: data.password,
        role: data.role,
        active: data.active,
        profile_image: data.profile_image || undefined,
        created_at: data.created_at,
      };
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
      if (now - lastUpdate > 60000) { // Throttle to max once per minute
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
            logout(); // Session expired
          }
        } catch (e) {}
      }
    }, 10000); // Check every 10 seconds

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

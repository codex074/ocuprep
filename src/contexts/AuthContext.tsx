import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
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
        const { user: u, location: loc } = JSON.parse(stored);
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
              localStorage.setItem('ed-extemp-session', JSON.stringify({ user: freshUser, location: loc || '' }));
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
      profile_image: data.profile_image || undefined,
      created_at: data.created_at,
    };

    setUser(u);
    // Do not set location here, it will be set in selectStation
    // But we might want to check if they had a previous session? No, fresh login implies fresh station select usually.
    // However, we need to save the user to local storage so they stay logged in.
    // We'll update the session storage to just have user for now, or keep separate keys?
    // The existing code uses a single object. Let's keep it but location might be empty initially.
    localStorage.setItem('ed-extemp-session', JSON.stringify({ user: u, location: '' }));
    return null;
  };

  const selectStation = (loc: string) => {
    setLocation(loc);
    if (user) {
        localStorage.setItem('ed-extemp-session', JSON.stringify({ user, location: loc }));
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
      localStorage.setItem('ed-extemp-session', JSON.stringify({ user: u, location }));
    }
  };

  const logout = () => {
    setUser(null);
    setLocation('');
    localStorage.removeItem('ed-extemp-session');
  };

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

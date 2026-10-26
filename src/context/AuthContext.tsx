import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMe, getStoredUser, logout as apiLogout, onUserUpdated, type User } from '../lib/api';

interface AuthValue {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [loading, setLoading] = useState<boolean>(() => !!localStorage.getItem('token'));

  // Sinkron kalau api.ts menyimpan/menghapus user (refresh token, logout, upload foto)
  useEffect(() => onUserUpdated(setUser), []);

  // Saat aplikasi dimuat: ambil data segar dari /api/me.
  // Kalau token kedaluwarsa, interceptor otomatis refresh lalu mengulang request.
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }
    fetchMe()
      .catch(() => {}) // kalau gagal total, interceptor sudah mengarahkan ke /login
      .finally(() => setLoading(false));
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchMe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout: apiLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // sesuaikan path jika berbeda

interface SidebarProps {
  // Opsional: kalau tidak diisi, pakai logout() dari AuthContext
  // (panggil POST /logout, hapus cookie refresh_token, bersihkan localStorage).
  onLogout?: () => void;
}

interface MenuItem {
  to: string;
  icon: string;
  label: string;
  // Sesuai RequirePermission di backend. Kosong = cukup login.
  // Menu tampil kalau user punya SALAH SATU permission ini.
  anyOf?: string[];
}

const MENU: MenuItem[] = [
  // GET /api/admin/dashboard-stats -> view-weather
  { to: '/admin/dashboard', icon: '🏠', label: 'Dashboard', anyOf: ['view-weather'] },

  // /api/admin/stations -> manage-stations
  { to: '/admin/stations', icon: '📍', label: 'Kelola Kecamatan/lokasi', anyOf: ['manage-stations'] },

  // GET /api/admin/weather-predictions -> cukup login (filter di controller)
  { to: '/admin/weather-predictions', icon: '📈', label: 'Data Prediksi AI' },

  // GET /api/admin/rbac -> view-weather
  { to: '/admin/rbac', icon: '🛡️', label: 'Kelola RBAC', anyOf: ['view-weather'] },

  // PUT /users/:id/roles, /roles, /roles/:id/permissions
  {
    to: '/admin/roles-permissions',
    icon: '🔐',
    label: 'Role & Permission',
    anyOf: ['manage-roles', 'manage-role-permissions', 'manage-user-roles'],
  },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer ${
    isActive
      ? 'bg-cyan-50 font-semibold text-cyan-700 shadow-[inset_0_0_0_1px_rgba(6,182,212,.2)] dark:bg-cyan-500/10 dark:text-cyan-300 dark:shadow-[inset_0_0_0_1px_rgba(34,211,238,.18)]'
      : 'text-slate-600 hover:bg-slate-100 hover:text-cyan-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100'
  }`;

// SVG ikon per path — MENU array tetap tidak diubah
const ICONS: Record<string, ReactNode> = {
  '/admin/dashboard': (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  '/admin/stations': (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  '/admin/weather-predictions': (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  '/admin/rbac': (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 4v5c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V7l8-4z" />
    </svg>
  ),
  '/admin/roles-permissions': (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 118 0v4" />
    </svg>
  ),
};

export default function Sidebar({ onLogout }: SidebarProps) {
  // User + permission disinkronkan otomatis oleh AuthContext (dari /api/me)
  const { user, logout: authLogout } = useAuth();
  const permissions = user?.permissions ?? null;

  // Kalau permission belum tersedia (mis. backend belum mengirim), tampilkan semua menu;
  // backend tetap menolak (403) lewat RequirePermission.
  const visibleMenu = MENU.filter(
    (m) => !m.anyOf || !permissions || m.anyOf.some((p) => permissions.includes(p)),
  );

  const handleLogout = () => (onLogout ? onLogout() : void authLogout());

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white text-slate-700 transition-colors duration-300 dark:border-slate-800 dark:bg-[#0b1220] dark:text-slate-200">
      {/* Label navigasi (mirip Blade) */}
      <div className="px-4 pb-2 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          navigasi
        </p>
      </div>

      {/* Menu Navigasi */}
      <ul className="flex flex-col gap-1 px-2">
        {visibleMenu.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} className={linkClass}>
              {({ isActive }) => (
                <>
                  {/* Aksen kiri (hanya aktif) */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-cyan-500 transition-opacity dark:bg-cyan-400 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  {ICONS[item.to] ?? (
                    <span className="h-5 w-5 shrink-0 text-center">{item.icon}</span>
                  )}
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Footer Sidebar */}
      <div className="mt-auto border-t border-slate-200 p-4 dark:border-slate-800">
        {user && (
          <div className="mb-3 px-1">
            <p className="m-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
              {user.name ?? user.username}
            </p>
            {user.role && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {user.role}
              </span>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Keluar
        </button>

        {/* Status bawah (mirip Blade) */}
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            online
          </span>
          <span>v2.0</span>
        </div>
      </div>
    </aside>
  );
}
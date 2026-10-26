// src/components/Navbar.tsx
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // sesuaikan path jika berbeda

// "Super Admin BMKG" -> "SA", "Budi" -> "BU"
const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

interface NavbarProps {
  /** Klik ikon sidebar di desktop. Kosongkan jika sidebar selalu terbuka. */
  onToggleSidebar?: () => void;
  /** Klik ikon hamburger di mobile. */
  onToggleMobileSidebar?: () => void;
  /** Href brand. Default: "/admin/dashboard". */
  brandHref?: string;
  /** Callback custom saat logout. Default: logout() dari AuthContext (cabut sesi di server, redirect ke /login). */
  onLogout?: () => void;
  /** Path avatar fallback (di folder public). Default: "/images/images1.png". */
  fallbackAvatar?: string;
}

export default function Navbar({
  onToggleSidebar,
  onToggleMobileSidebar,
  brandHref = '/admin/dashboard',
  onLogout,
  fallbackAvatar = '/images/images1.png',
}: NavbarProps) {
  // User disinkronkan otomatis oleh AuthContext (login, refresh token, upload/hapus foto, logout)
  const { user, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  /* Reset error gambar jika URL avatar berubah (misal setelah upload foto baru) */
  useEffect(() => {
    setImgError(false);
  }, [user?.avatar]);

  /* Terapkan & simpan tema */
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  /* Klik di luar & Escape untuk tutup dropdown */
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    if (onLogout) onLogout();
    else void logout(); // POST /logout, bersihkan sesi, lalu redirect ke /login
  };

  const displayName = user?.name || user?.username || 'Pengguna';
  const displayRole = user?.role || '-';
  const displayEmail = user?.email || user?.username || '';
  const avatarSrc = user?.avatar || fallbackAvatar;

  return (
    <nav className="relative z-50 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-3 text-slate-800 transition-colors duration-300 dark:border-slate-800 dark:bg-[#0b1220] dark:text-slate-100">
      {/* ============ LEFT: Toggle + Brand ============ */}
      <div className="flex items-center gap-2">
        {/* Mobile Sidebar Toggle */}
        <button
          type="button"
          aria-label="Buka menu"
          onClick={onToggleMobileSidebar}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 md:hidden dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-cyan-300"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Desktop Sidebar Toggle */}
        <button
          type="button"
          aria-label="Sembunyikan sidebar"
          onClick={onToggleSidebar}
          className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 md:block dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-cyan-300"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 4.5v15M15 4.5v15M4.125 19.5h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
        </button>

        {/* Brand (Menggunakan Link agar SPA) */}
        <Link
          to={brandHref}
          className="ml-1 flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-50 dark:border-cyan-400/25 dark:bg-cyan-400/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
            </svg>
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Weather<span className="text-cyan-600 dark:text-cyan-400">Batam</span>
          </span>
        </Link>
      </div>

      {/* ============ RIGHT: Theme toggle + User ============ */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        <button
          type="button"
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-cyan-400/50 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-cyan-400/50 dark:hover:text-cyan-300"
        >
          {/* Moon (tampil di light mode) */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px] dark:hidden" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
          {/* Sun (tampil di dark mode) */}
          <svg xmlns="http://www.w3.org/2000/svg" className="hidden h-[18px] w-[18px] dark:block" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>

        {user && (
          <div className="relative">
            {/* Tombol Profil */}
            <button
              ref={btnRef}
              type="button"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:hover:bg-white/5"
            >
              {imgError ? (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 text-xs font-bold text-white ring-2 ring-transparent transition-all hover:ring-cyan-400/30">
                  {getInitials(displayName)}
                </span>
              ) : (
                <img
                  src={avatarSrc}
                  alt=""
                  width={36}
                  height={36}
                  onError={() => setImgError(true)}
                  className="h-9 w-9 rounded-full border border-slate-200 object-cover ring-2 ring-transparent transition-all hover:ring-cyan-400/30 dark:border-slate-700"
                />
              )}
              <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 md:inline dark:text-slate-200">
                {displayName}
              </span>
              <svg className="hidden h-4 w-4 text-slate-400 md:block dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Menu Dropdown */}
            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-[#0b1220] dark:shadow-cyan-950/40"
              >
                <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" />

                <div className="border-b border-slate-200 p-4 text-center dark:border-slate-800">
                  {imgError ? (
                    <span className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500 to-indigo-500 text-lg font-bold text-white">
                      {getInitials(displayName)}
                    </span>
                  ) : (
                    <img
                      src={avatarSrc}
                      alt=""
                      width={64}
                      height={64}
                      onError={() => setImgError(true)}
                      className="mx-auto mb-2 h-16 w-16 rounded-full border-2 border-cyan-500/30 object-cover"
                    />
                  )}
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</div>
                  <div className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">{displayEmail}</div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">
                    {displayRole}
                  </div>
                </div>

                {/* Link ke Halaman Profil */}
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-cyan-700 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-cyan-300"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profil
                </Link>

                <hr className="border-slate-200 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
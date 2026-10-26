import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, saveSession, fetchMe } from '../lib/api';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Terapkan class "dark" ke <html> + simpan preferensi
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post(
        `${API_URL}/login`,
        { username, password },
        { withCredentials: true },
      );

      // Simpan token + data dasar + avatar (URL foto sudah dijadikan absolut di saveSession)
      saveSession(response.data.data);

      // Ambil data lengkap dari /api/me (termasuk email).
      // Kalau gagal, login tetap berhasil dengan data dasar dari /login.
      try {
        await fetchMe();
      } catch {
        /* data dasar sudah cukup untuk lanjut */
      }

      setMessage('Login Berhasil! Mengalihkan...');

      setTimeout(() => {
        window.location.href = '/admin/dashboard';
      }, 500);
    } catch (err: any) {
      setLoading(false);
      setMessage(
        err.response?.data?.data?.error ||
          err.response?.data?.error ||
          'Login gagal, periksa kembali username atau password.',
      );
    }
  };

  const isSuccess = message.includes('Berhasil');

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans transition-colors duration-300 dark:bg-[#070b12] lg:flex">
      {/* ================= KIRI: Panel Branding Batam ================= */}
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-slate-900 via-blue-950 to-cyan-900 lg:flex lg:w-1/2">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative z-10 flex w-full flex-col">
          <div className="flex items-center gap-3 p-9">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <svg className="h-5 w-5 text-cyan-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-wide text-white">Weather API Batam</p>
              <p className="text-[11px] text-cyan-200/70">Panel Administrasi</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center px-9 pb-6">
            <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-200 ring-1 ring-cyan-400/20">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              Kepulauan Riau · Indonesia
            </span>

            <h1 className="text-3xl font-bold leading-tight text-white">
              Selamat datang di<br />
              <span className="bg-linear-to-r from-cyan-300 via-cyan-400 to-amber-300 bg-clip-text text-transparent">
                Kota Batam
              </span>
            </h1>

            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300/80">
              Kelola dan pantau data cuaca Kota Batam dalam satu panel yang cepat,
              aman, dan mudah digunakan.
            </p>

            <ul className="mt-7 space-y-3 text-sm text-slate-200/90">
              {[
                'Data cuaca real-time & terpercaya',
                'Akses aman dengan access token',
                'Manajemen data terpusat dan rapi',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-400/15 ring-1 ring-cyan-300/30">
                    <svg className="h-3.5 w-3.5 text-cyan-300" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="px-9 pb-3 text-[11px] text-slate-400/80">
            © {new Date().getFullYear()} Weather API Batam · Jembatan Barelang
          </p>

          <svg viewBox="0 0 600 200" className="relative z-0 block w-full" aria-hidden="true">
            <defs>
              <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e7490" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.95" />
              </linearGradient>
              <radialGradient id="sunGlow">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>

            <circle cx="452" cy="66" r="90" fill="url(#sunGlow)" />
            <circle cx="452" cy="66" r="24" fill="#fcd34d" />

            <path d="M0 132 C 55 104 105 122 155 132 Z" fill="#0f172a" opacity="0.55" />
            <path d="M600 132 C 545 106 500 120 448 132 Z" fill="#0f172a" opacity="0.55" />

            <rect x="0" y="130" width="600" height="70" fill="url(#seaGrad)" />
            <rect x="0" y="126" width="600" height="5" rx="2.5" fill="#0b1220" />

            <rect x="150" y="62" width="8" height="66" fill="#0b1220" />
            <rect x="352" y="62" width="8" height="66" fill="#0b1220" />
            <rect x="138" y="56" width="32" height="6" rx="3" fill="#0b1220" />
            <rect x="340" y="56" width="32" height="6" rx="3" fill="#0b1220" />

            <g stroke="#0b1220" strokeWidth="1.3" opacity="0.85">
              <line x1="154" y1="62" x2="62" y2="126" />
              <line x1="154" y1="62" x2="92" y2="126" />
              <line x1="154" y1="62" x2="120" y2="126" />
              <line x1="154" y1="62" x2="142" y2="126" />
              <line x1="154" y1="62" x2="172" y2="126" />
              <line x1="154" y1="62" x2="202" y2="126" />
              <line x1="154" y1="62" x2="232" y2="126" />

              <line x1="356" y1="62" x2="278" y2="126" />
              <line x1="356" y1="62" x2="308" y2="126" />
              <line x1="356" y1="62" x2="338" y2="126" />
              <line x1="356" y1="62" x2="368" y2="126" />
              <line x1="356" y1="62" x2="398" y2="126" />
              <line x1="356" y1="62" x2="428" y2="126" />
              <line x1="356" y1="62" x2="458" y2="126" />
              <line x1="356" y1="62" x2="508" y2="126" />
            </g>

            <g stroke="#22d3ee" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round">
              <line x1="110" y1="150" x2="190" y2="150" />
              <line x1="250" y1="150" x2="300" y2="150" />
              <line x1="390" y1="150" x2="470" y2="150" />
              <line x1="150" y1="166" x2="210" y2="166" />
              <line x1="330" y1="166" x2="400" y2="166" />
              <line x1="470" y1="170" x2="520" y2="170" />
            </g>
          </svg>
        </div>
      </aside>

      {/* ================= KANAN: Form Login ================= */}
      <main className="relative flex w-full flex-col bg-white px-6 py-10 transition-colors duration-300 sm:px-10 lg:w-1/2 lg:px-12 lg:py-12 xl:px-20 dark:bg-[#070b12]">

        {/* Toggle Theme */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 sm:right-6 sm:top-6 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          {theme === 'dark' ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        <div className="mx-auto my-auto flex w-full max-w-md flex-col pt-6">
          {/* Brand ringkas (mobile) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-linear-to-br from-blue-600 to-cyan-600 shadow-lg shadow-blue-600/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Weather API Batam</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Kepulauan Riau · Indonesia</p>
            </div>
          </div>

          {/* Badge secure.auth */}
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/5 dark:text-cyan-300">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
            </span>
            secure.auth
          </div>

          {/* Header */}
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
            Masuk ke{' '}
            <span className="bg-linear-to-r from-cyan-600 via-cyan-500 to-amber-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-cyan-400 dark:to-amber-300">
              Panel Batam
            </span>
          </h2>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Gunakan akun yang terdaftar untuk melanjutkan ke panel administrasi.
          </p>

          {/* Divider */}
          <div className="my-6 h-px bg-linear-to-r from-transparent via-cyan-400/45 to-transparent" />

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Username */}
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Username / Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 1115 0v.75H4.5v-.75z" />
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username atau email..."
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:bg-slate-800/60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 0h10.5a1.5 1.5 0 011.5 1.5v6.75a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5v-6.75a1.5 1.5 0 011.5-1.5z" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-12 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:bg-slate-800/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.879 9.879" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 ${
                loading
                  ? 'cursor-not-allowed bg-slate-400 shadow-none'
                  : 'cursor-pointer bg-linear-to-r from-blue-600 to-cyan-600 shadow-blue-600/25 hover:from-blue-700 hover:to-cyan-700 hover:shadow-blue-600/35 active:scale-[0.99] dark:from-cyan-500 dark:to-indigo-500 dark:shadow-cyan-500/20 dark:hover:from-cyan-600 dark:hover:to-indigo-600'
              }`}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  Masuk
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Message */}
          {message && (
            <div
              className={`mt-6 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-medium ${
                isSuccess
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-300'
                  : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/5 dark:text-rose-300'
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {isSuccess ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </span>
              <span className="leading-relaxed">{message}</span>
            </div>
          )}

          {/* Legal */}
          <p className="mt-6 px-2 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-500">
            Dengan melanjutkan, Anda menyetujui{' '}
            <a href="#" className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400">
              Ketentuan Layanan
            </a>{' '}
            dan{' '}
            <a href="#" className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400">
              Kebijakan Privasi
            </a>{' '}
            kami.
          </p>

          <p className="mt-10 text-center text-[11px] text-slate-400 lg:hidden dark:text-slate-500">
            © {new Date().getFullYear()} Weather API Batam · Kepulauan Riau
          </p>
        </div>
      </main>
    </div>
  );
}
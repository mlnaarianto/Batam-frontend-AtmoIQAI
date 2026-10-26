import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface DashboardStats {
  total_stations: number;
  total_predictions: number;
  ai_server_status: string;
  database_status: string;
}

const INITIAL_STATS: DashboardStats = {
  total_stations: 0,
  total_predictions: 0,
  ai_server_status: '-',
  database_status: '-',
};

// Helper tampilan saja (tidak mengubah state / logika)
const isHealthy = (s: string) =>
  /online|ok|connected|active|running|healthy|up|ready/i.test(s ?? '');

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        // Token & auto-refresh ditangani interceptor di lib/api.ts
        const res = await api.get('/api/admin/dashboard-stats');
        // Dukung respons { data: {...} } maupun langsung {...}
        const payload = res.data?.data ?? res.data;
        if (!cancelled) setStats({ ...INITIAL_STATS, ...payload });
      } catch (err) {
        console.error('Gagal mengambil statistik dashboard', err);
        if (!cancelled) setError('Gagal memuat statistik. Coba muat ulang halaman.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const aiHealthy = isHealthy(stats.ai_server_status);
  const dbHealthy = isHealthy(stats.database_status);

  return (
    <div className="space-y-6">
      {/* ============ Header ============ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/5 dark:text-cyan-300">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
            </span>
            overview
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            Dashboard{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-amber-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-cyan-400 dark:to-amber-300">
              AtmoIQ AI
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ringkasan status sistem dan data cuaca Kota Batam.
          </p>
        </div>
      </div>

      {/* Divider aksen */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      {/* ============ Error ============ */}
      {error && (
        <div
          role="alert"
          className="relative overflow-hidden rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/5 dark:text-rose-300"
        >
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />
          <div className="flex items-start gap-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="leading-relaxed">{error}</span>
          </div>
        </div>
      )}

      {/* ============ Section label ============ */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          statistik
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          realtime
        </span>
      </div>

      {/* ============ Kartu Statistik ============ */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* --- Kartu 1: Total Kecamatan/Lokasi (tema senja) --- */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-white shadow-lg shadow-orange-500/20 ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-0.5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                lokasi
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
            </div>

            <h3 className="text-xs font-medium text-white/85">
              Total Kecamatan/Lokasi (Saat ini Batam)
            </h3>
            <p className="mt-1 font-mono text-4xl font-bold tracking-tight">
              {loading ? (
                <span className="inline-block h-9 w-16 animate-pulse rounded-md bg-white/25" />
              ) : (
                <>
                  {stats.total_stations}
                  <span className="ml-1.5 text-base font-medium text-white/70">unit</span>
                </>
              )}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/75">
              <span className="h-1 w-1 rounded-full bg-white/70" aria-hidden="true" />
              Terdaftar di database sistem
            </p>
          </div>
        </div>

        {/* --- Kartu 2: Status Server AI (tema samudra) --- */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 p-6 text-white shadow-lg shadow-blue-600/20 ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-0.5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                ai · lstm
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                  <path strokeLinecap="round" d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
                </svg>
              </span>
            </div>

            <h3 className="text-xs font-medium text-white/85">
              Status Server AI (LSTM + ENSO)
            </h3>
            <p className="mt-1 flex items-baseline gap-2 font-mono text-4xl font-bold tracking-tight capitalize">
              {loading ? (
                <span className="inline-block h-9 w-28 animate-pulse rounded-md bg-white/25" />
              ) : (
                <>
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      aiHealthy ? 'bg-emerald-300' : 'bg-amber-200'
                    }`}
                    aria-hidden="true"
                  />
                  {stats.ai_server_status}
                </>
              )}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/75">
              <span className="h-1 w-1 rounded-full bg-white/70" aria-hidden="true" />
              Model 30 tahun siap inferensi
            </p>
          </div>
        </div>

        {/* --- Kartu 3: Koneksi Database (tema hutan tropis) --- */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 p-6 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-0.5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                database
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor">
                  <ellipse cx="12" cy="6" rx="7" ry="3" />
                  <path strokeLinecap="round" d="M5 6v6c0 1.657 3.134 3 7 3s7-1.343 7-3V6" />
                  <path strokeLinecap="round" d="M5 12v6c0 1.657 3.134 3 7 3s7-1.343 7-3v-6" />
                </svg>
              </span>
            </div>

            <h3 className="text-xs font-medium text-white/85">
              Koneksi Database &amp; Log
            </h3>
            <p className="mt-1 flex items-baseline gap-2 font-mono text-4xl font-bold tracking-tight capitalize">
              {loading ? (
                <span className="inline-block h-9 w-28 animate-pulse rounded-md bg-white/25" />
              ) : (
                <>
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      dbHealthy ? 'bg-emerald-200' : 'bg-amber-200'
                    }`}
                    aria-hidden="true"
                  />
                  {stats.database_status}
                </>
              )}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/75">
              <span className="h-1 w-1 rounded-full bg-white/70" aria-hidden="true" />
              {loading ? 'Memuat jumlah log...' : `${stats.total_predictions} total log prediksi tersimpan`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
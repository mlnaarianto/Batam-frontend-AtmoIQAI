import { useState, useEffect, useRef, useCallback } from 'react';
import axios, { isAxiosError } from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api, API_URL } from '../lib/api';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  shadowSize: [41, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Station {
  id: string;
  station_code: string;
  station_name: string;
  latitude: number;
  longitude: number;
  region?: string | null;
  status_active: boolean;
}

interface WeatherPrediction {
  id: string;
  user_id?: string;
  station_id: string;
  prediction_date: string;
  temperature: number;
  humidity: number;
  rainfall: number;
  air_pressure: number;
  wind_speed: number | null;
  wind_direction: number | null;
  enso_index: number | null;
  climate_phase: string | null;
  status_weather: string;
  confidence_score: number | null;
  uncertainty_metric: number | null;
  model_version: string | null;
  prediction_horizon: number | null;
  station?: {
    id: string;
    station_name: string;
    station_code: string;
    latitude: number;
    longitude: number;
  } | null;
}

// AI service adalah server terpisah -> pakai axios polos, bukan instance `api`
const AI_SERVICE_BASE = import.meta.env.VITE_AI_URL ?? 'http://localhost:8005';
const LOCAL_KEY = 'local_ai_predictions';
const BATAM_CENTER: [number, number] = [1.1301, 104.0529];

function readLocal(): WeatherPrediction[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(data: WeatherPrediction[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Gagal menyimpan data lokal', e);
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 403) return 'Kamu tidak punya izin untuk aksi ini.';
    const d = err.response?.data;
    return d?.detail || d?.message || d?.error || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

const isValidCoord = (n: unknown): n is number => typeof n === 'number' && !Number.isNaN(n);

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Helper tampilan saja — tidak mengubah data
function ensoBadgeClass(phase: string | null | undefined) {
  if (phase === 'El Nino')
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300';
  if (phase === 'La Nina')
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300';
  return 'border-slate-300/60 bg-slate-500/10 text-slate-600 dark:border-slate-600 dark:bg-slate-500/10 dark:text-slate-300';
}

export default function WeatherPredictionsPage() {
  const [predictions, setPredictions] = useState<WeatherPrediction[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedPrediction, setSelectedPrediction] = useState<WeatherPrediction | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [selectedStationId, setSelectedStationId] = useState('ALL');
  const [mapCenter, setMapCenter] = useState<[number, number]>(BATAM_CENTER);

  // Penanda request terakhir supaya respons lama tidak menimpa yang baru
  const fetchSeq = useRef(0);

  const loadPredictions = useCallback(async (stationId: string) => {
    const seq = ++fetchSeq.current;
    try {
      // Login -> endpoint admin, tidak login -> endpoint publik.
      // Token & auto-refresh ditangani interceptor di lib/api.ts
      const hasToken = !!localStorage.getItem('token');
      const path = hasToken ? '/api/admin/weather-predictions' : '/api/public/weather-predictions';
      const params = stationId !== 'ALL' ? { station_id: stationId } : undefined;

      const response = await api.get(path, { params });
      if (seq !== fetchSeq.current) return;

      const payload = response.data?.data ?? response.data;
      const dbData: WeatherPrediction[] = Array.isArray(payload) ? payload : [];

      let localData = readLocal();
      if (stationId !== 'ALL') {
        localData = localData.filter((p) => p.station_id === stationId);
      }

      setPredictions([...localData, ...dbData]);
      setError('');
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      setError(getErrorMessage(err, 'Gagal mengambil data prediksi'));
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, []);

  // Daftar stasiun: selalu pakai endpoint publik (tidak butuh permission manage-stations)
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const response = await api.get('/api/public/stations');
        const payload = response.data?.data ?? response.data;
        setStations(Array.isArray(payload) ? payload : []);
      } catch (err) {
        console.error('Gagal mengambil daftar kecamatan', err);
      }
    };
    fetchStations();
  }, []);

  // Muat prediksi setiap kali wilayah berubah
  useEffect(() => {
    setLoading(true);
    loadPredictions(selectedStationId);
  }, [selectedStationId, loadPredictions]);

  const handleSelectStation = (stationId: string) => {
    setSelectedStationId(stationId);
    if (stationId !== 'ALL') {
      const target = stations.find((s) => s.id === stationId);
      if (target) setMapCenter([target.latitude, target.longitude]);
    }
  };

  // Koordinat station (atau GPS user) selalu dikirim ke AI service,
  // supaya prediksi tidak jatuh ke koordinat default untuk semua kecamatan.
  const runAIPredictionForStation = async (
    station: Station,
    coords?: { latitude: number; longitude: number },
  ) => {
    if (isProcessingAI) return;

    const latitude = coords?.latitude ?? station.latitude;
    const longitude = coords?.longitude ?? station.longitude;

    if (!isValidCoord(latitude) || !isValidCoord(longitude)) {
      setNotice({ type: 'error', text: 'Koordinat wilayah tidak valid, tidak bisa menjalankan prediksi AI.' });
      return;
    }

    setIsProcessingAI(true);
    setNotice(null);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        // Mode publik: hasil disimpan sementara di localStorage perangkat
        const res = await axios.post(`${AI_SERVICE_BASE}/predict-local`, {
          station_id: station.id,
          latitude,
          longitude,
        });
        const newPrediction: WeatherPrediction = {
          ...res.data.data,
          id: `local-${Date.now()}`,
          station,
        };
        writeLocal([newPrediction, ...readLocal()]);

        setNotice({
          type: 'success',
          text: `AI berhasil memprediksi cuaca untuk ${station.station_name}. Data disimpan sementara di perangkat Anda.`,
        });
      } else {
        // Mode admin: AI service menyimpan hasilnya ke backend memakai token ini
        let activeUserId = '';
        try {
          activeUserId = JSON.parse(localStorage.getItem('user') || '{}').id || '';
        } catch (e) {
          console.error('Gagal parse data user', e);
        }

        await axios.post(`${AI_SERVICE_BASE}/predict-and-save`, {
          station_id: station.id,
          user_id: activeUserId,
          latitude,
          longitude,
          backend_url: `${API_URL}/api/admin/weather-predictions`,
          token,
        });

        setNotice({
          type: 'success',
          text: `AI LSTM Klimatologi (ENSO) berhasil memprediksi cuaca ${station.station_name} dan menyimpannya ke database.`,
        });
      }

      await loadPredictions(station.id === selectedStationId ? selectedStationId : station.id);
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: 'Gagal memproses AI: ' + getErrorMessage(err, 'terjadi kesalahan') });
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handlePredictSelectedStation = async () => {
    if (selectedStationId === 'ALL') {
      setNotice({
        type: 'error',
        text: 'Pilih salah satu wilayah/kecamatan dari dropdown atau klik marker pada peta terlebih dahulu.',
      });
      return;
    }
    const currentStation = stations.find((s) => s.id === selectedStationId);
    if (!currentStation) {
      setNotice({ type: 'error', text: 'Data stasiun tidak ditemukan.' });
      return;
    }
    await runAIPredictionForStation(currentStation);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setNotice({ type: 'error', text: 'Browser Anda tidak mendukung Geolocation.' });
      return;
    }
    if (stations.length === 0) {
      setNotice({ type: 'error', text: 'Daftar stasiun belum tersedia.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        setMapCenter([userLat, userLon]);

        let closest = stations[0];
        let minDistance = Math.hypot(closest.latitude - userLat, closest.longitude - userLon);
        for (const s of stations) {
          const dist = Math.hypot(s.latitude - userLat, s.longitude - userLon);
          if (dist < minDistance) {
            minDistance = dist;
            closest = s;
          }
        }

        setSelectedStationId(closest.id);
        // Kirim koordinat GPS user (lebih akurat), tetap dicatat ke stasiun terdekat
        await runAIPredictionForStation(closest, { latitude: userLat, longitude: userLon });
      },
      (err) => {
        console.error(err);
        setNotice({
          type: 'error',
          text: 'Gagal mendapatkan lokasi GPS Anda. Pastikan izin lokasi diaktifkan.',
        });
      },
    );
  };

  const handleShowDetail = (id: string) => {
    const found = predictions.find((p) => p.id === id);
    if (found) {
      setSelectedPrediction(found);
      setShowModal(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    if (!window.confirm('Apakah Anda yakin ingin menghapus log prediksi ini?')) return;

    setNotice(null);

    if (id.startsWith('local-')) {
      writeLocal(readLocal().filter((p) => p.id !== id));
      await loadPredictions(selectedStationId);
      return;
    }

    if (!localStorage.getItem('token')) {
      setNotice({ type: 'error', text: 'Anda tidak memiliki akses untuk menghapus data dari server.' });
      return;
    }

    setDeletingId(id);
    try {
      await api.delete(`/api/admin/weather-predictions/${id}`);
      setNotice({ type: 'success', text: 'Log prediksi berhasil dihapus.' });
      await loadPredictions(selectedStationId);
    } catch (err) {
      setNotice({ type: 'error', text: getErrorMessage(err, 'Gagal menghapus data prediksi') });
    } finally {
      setDeletingId(null);
    }
  };

  const selectedStationName = stations.find((s) => s.id === selectedStationId)?.station_name;

  return (
    <div className="space-y-6">
      {/* ============ Header ============ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/5 dark:text-cyan-300">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
            </span>
            prediksi · ai
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            Dashboard Prediksi{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-amber-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-cyan-400 dark:to-amber-300">
              Cuaca & Klimatologi AI
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Pilih wilayah kecamatan atau gunakan lokasi saat ini untuk memicu prediksi AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePredictSelectedStation}
            disabled={isProcessingAI || selectedStationId === 'ALL'}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-700 hover:to-cyan-700 hover:shadow-blue-600/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none dark:from-cyan-500 dark:to-indigo-500 dark:shadow-cyan-500/20 dark:hover:from-cyan-600 dark:hover:to-indigo-600"
          >
            {isProcessingAI ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                  <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
                Memproses...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7l-1 7 9-11h-7z" />
                </svg>
                Prediksi Wilayah Ini
              </>
            )}
          </button>

          <button
            onClick={handleUseCurrentLocation}
            disabled={isProcessingAI}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/15"
          >
            {isProcessingAI ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                  <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
                Memproses...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.5-7-12a7 7 0 1114 0c0 5.5-7 12-7 12z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                Gunakan Lokasi Saya
              </>
            )}
          </button>
        </div>
      </div>

      {/* Divider */}
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

      {/* ============ Notice ============ */}
      {notice && (
        <div
          className={`relative overflow-hidden rounded-xl border p-3.5 text-xs font-medium ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/5 dark:text-rose-300'
          }`}
        >
          <div
            aria-hidden="true"
            className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${
              notice.type === 'success' ? 'via-emerald-500/60' : 'via-rose-500/60'
            }`}
          />
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0">
              {notice.type === 'success' ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </span>
            <span className="leading-relaxed">{notice.text}</span>
          </div>
        </div>
      )}

      {/* ============ Filter + Peta ============ */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600 ring-1 ring-cyan-500/25 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/25">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Filter Wilayah</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  pilih kecamatan untuk inferensi
                </p>
              </div>
            </div>

            <div className="w-full sm:w-72">
              <label htmlFor="station-select" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Pilih Wilayah / Kecamatan
              </label>
              <select
                id="station-select"
                value={selectedStationId}
                onChange={(e) => handleSelectStation(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/10"
              >
                <option value="ALL">Semua Wilayah</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.station_name} ({s.station_code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] italic text-slate-400 dark:text-slate-500">
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Klik marker pada peta untuk melihat atau memfilter data prediksi area tersebut.
          </p>
        </div>

        <div className="relative z-0 h-80 w-full">
          <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
            <MapController center={mapCenter} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {stations.map((st) => (
              <Marker
                key={st.id}
                position={[st.latitude, st.longitude]}
                eventHandlers={{ click: () => handleSelectStation(st.id) }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong className="mb-1 block font-bold text-slate-900">{st.station_name}</strong>
                    <span className="mb-2 block font-mono text-[10px] uppercase tracking-wide text-slate-500">
                      Kode: {st.station_code}
                    </span>
                    <button
                      onClick={() => handleSelectStation(st.id)}
                      className="cursor-pointer rounded-md bg-gradient-to-r from-blue-600 to-cyan-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    >
                      Pilih Wilayah Ini
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* ============ Section label ============ */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          hasil inferensi
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {predictions.length} data
        </span>
      </div>

      {/* ============ Tabel Hasil Inferensi ============ */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/40">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Hasil Inferensi Model{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">
              {selectedStationId !== 'ALL' ? `— ${selectedStationName ?? ''}` : '(Semua Wilayah)'}
            </span>
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            {predictions.length} data
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
                <th className="px-6 py-3 font-semibold">Waktu Prediksi</th>
                <th className="px-6 py-3 font-semibold">Kecamatan</th>
                <th className="px-6 py-3 font-semibold">Estimasi Cuaca</th>
                <th className="px-6 py-3 font-semibold">Fase Iklim (ENSO)</th>
                <th className="px-6 py-3 font-semibold">Suhu & Kelembapan</th>
                <th className="px-6 py-3 font-semibold">Curah Hujan & Tekanan</th>
                <th className="px-6 py-3 font-semibold">Confidence</th>
                <th className="px-6 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700 dark:divide-slate-800 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400 italic dark:text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin text-cyan-500" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                        <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      Memuat data inferensi AI...
                    </div>
                  </td>
                </tr>
              ) : predictions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400 italic dark:text-slate-500">
                    Belum ada log prediksi cuaca untuk wilayah ini.
                  </td>
                </tr>
              ) : (
                predictions.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(item.prediction_date)}
                      </span>
                      {item.id.startsWith('local-') && (
                        <span className="mt-1 block w-max rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                          data lokal
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-indigo-500 text-[10px] font-bold text-white">
                          {(item.station?.station_name || '??').slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {item.station?.station_name || 'Tidak diketahui'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-md border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300">
                        {item.status_weather}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${ensoBadgeClass(
                          item.climate_phase,
                        )}`}
                      >
                        {item.climate_phase || 'Netral'}
                        {item.enso_index !== null ? ` (${item.enso_index})` : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                      {item.temperature}°C{' '}
                      <span className="font-normal text-slate-400 dark:text-slate-500">
                        ({item.humidity}%)
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {item.rainfall} mm{' '}
                      <span className="block font-mono text-[10px] text-slate-400 dark:text-slate-500">
                        {item.air_pressure} hPa
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.confidence_score !== null ? `${item.confidence_score}%` : '-'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          unc: {item.uncertainty_metric ?? '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleShowDetail(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-cyan-400/50 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:border-cyan-400/40 dark:hover:text-cyan-300"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Show
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:border-rose-400/60 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 disabled:opacity-50 dark:border-rose-500/30 dark:bg-slate-800/40 dark:text-rose-400 dark:hover:border-rose-400/50 dark:hover:bg-rose-500/10"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                          </svg>
                          {deletingId === item.id ? 'Menghapus...' : 'Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ MODAL DETAIL ============ */}
      {showModal && selectedPrediction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0b1220]">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600 ring-1 ring-cyan-500/25 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/25">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                    <path strokeLinecap="round" d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Detail Inferensi AI &amp; Klimatologi
                  </h3>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    hasil prediksi model lstm
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Tutup"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-[75vh] space-y-4 overflow-y-auto p-6 text-sm text-slate-700 dark:text-slate-300">
              {/* Wilayah & Waktu */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Wilayah / Stasiun
                  </span>
                  <span className="block text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedPrediction.station?.station_name || '-'}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    kode: {selectedPrediction.station?.station_code || '-'}
                  </span>
                </div>
                <div>
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Waktu Prediksi
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {formatDate(selectedPrediction.prediction_date)}
                  </span>
                </div>
              </div>

              {/* Cuaca & ENSO */}
              <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 dark:border-blue-400/25 dark:bg-blue-400/10">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                    Estimasi Cuaca
                  </span>
                  <span className="mt-1 block text-lg font-bold text-blue-900 dark:text-blue-200">
                    {selectedPrediction.status_weather}
                  </span>
                </div>
                <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3 dark:border-indigo-400/25 dark:bg-indigo-400/10">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">
                    Fase Iklim (ENSO)
                  </span>
                  <span className="mt-1 block text-lg font-bold text-indigo-900 dark:text-indigo-200">
                    {selectedPrediction.climate_phase || 'Netral'}{' '}
                    {selectedPrediction.enso_index !== null ? `(${selectedPrediction.enso_index})` : ''}
                  </span>
                </div>
              </div>

              {/* Parameter cuaca */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Suhu Udara', value: `${selectedPrediction.temperature}°C` },
                  { label: 'Kelembapan', value: `${selectedPrediction.humidity}%` },
                  { label: 'Curah Hujan', value: `${selectedPrediction.rainfall} mm` },
                  { label: 'Tekanan Udara', value: `${selectedPrediction.air_pressure} hPa` },
                  { label: 'Kecepatan Angin', value: `${selectedPrediction.wind_speed ?? '-'} m/s` },
                  { label: 'Arah Angin', value: `${selectedPrediction.wind_direction ?? '-'}°` },
                ].map((p) => (
                  <div
                    key={p.label}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <span className="block text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {p.label}
                    </span>
                    <span className="mt-1 block font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                      {p.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer info */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <div>
                  Model AI:{' '}
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {selectedPrediction.model_version || 'LSTM-ENSO'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    Confidence:{' '}
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedPrediction.confidence_score !== null ? `${selectedPrediction.confidence_score}%` : '-'}
                    </span>
                  </span>
                  <span>
                    Uncertainty:{' '}
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {selectedPrediction.uncertainty_metric ?? '-'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/40">
              <button
                onClick={() => setShowModal(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
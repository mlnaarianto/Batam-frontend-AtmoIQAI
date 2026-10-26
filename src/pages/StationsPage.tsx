import { useState, useEffect, useRef, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../lib/api';

// --- FIX IKON MARKER LEAFLET DI REACT/VITE ---
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
// ---------------------------------------------

interface Station {
  id: string;
  station_code: string;
  station_name: string;
  latitude: number;
  longitude: number;
  region?: string | null;
  status_active: boolean;
}

interface StationForm {
  station_code: string;
  station_name: string;
  latitude: string;
  longitude: string;
  region: string;
  status_active: boolean;
}

const BATAM_CENTER: [number, number] = [1.1301, 104.0529];

const EMPTY_FORM: StationForm = {
  station_code: '',
  station_name: '',
  latitude: '',
  longitude: '',
  region: '',
  status_active: true,
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 403) return 'Kamu tidak punya izin untuk aksi ini.';
    const d = err.response?.data;
    return d?.message || d?.error || fallback;
  }
  return fallback;
}

// "Kecamatan Nongsa" -> "BTM-NONGSA"
const generateStationCode = (regionName: string) => {
  if (!regionName) return '';
  const cleanName = regionName
    .replace(/Kecamatan|Kota|Kabupaten/gi, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
  return `BTM-${cleanName}`;
};

// Komponen helper untuk menangkap klik pada peta di dalam Modal
function LocationSelector({
  position,
  setPosition,
  onSelectLocation,
}: {
  position: [number, number] | null;
  setPosition: (pos: [number, number]) => void;
  onSelectLocation: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onSelectLocation(lat, lng);
    },
  });

  return position === null ? null : <Marker position={position} />;
}

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Form (Tambah / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [formData, setFormData] = useState<StationForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [selectedCoord, setSelectedCoord] = useState<[number, number] | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Penanda request reverse-geocode terakhir, supaya respons lama tidak menimpa yang baru
  const geocodeSeq = useRef(0);

  const fetchStations = async () => {
    try {
      // Token & auto-refresh ditangani interceptor di lib/api.ts
      const response = await api.get('/api/admin/stations');
      const payload = response.data?.data ?? response.data;
      setStations(Array.isArray(payload) ? payload : []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengambil data kecamatan'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const handleOpenAddModal = () => {
    setNotice(null);
    setFormError('');
    setIsEditMode(false);
    setCurrentId(null);
    setFormData(EMPTY_FORM);
    setSelectedCoord(BATAM_CENTER);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: Station) => {
    setNotice(null);
    setFormError('');
    setIsEditMode(true);
    setCurrentId(item.id);
    setFormData({
      station_code: item.station_code,
      station_name: item.station_name,
      latitude: item.latitude.toString(),
      longitude: item.longitude.toString(),
      region: item.region || '',
      status_active: item.status_active,
    });
    setSelectedCoord([item.latitude, item.longitude]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    geocodeSeq.current++; // abaikan respons geocode yang masih berjalan
    setIsLocating(false);
    setIsModalOpen(false);
  };

  // Klik peta -> isi koordinat, lalu reverse geocoding ke backend untuk
  // mengisi region, nama kecamatan, dan kode kecamatan.
  const handleMapClickCoord = async (lat: number, lon: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
    }));
    setFormError('');

    const seq = ++geocodeSeq.current;
    setIsLocating(true);
    try {
      const response = await api.get('/api/admin/stations/reverse-geocode', {
        params: { lat, lon },
      });
      if (seq !== geocodeSeq.current) return; // sudah ada klik yang lebih baru

      const data = response.data?.data ?? response.data;
      const suggestedName: string = data?.suggested_name || '';
      const displayName: string = data?.display_name || '';

      setFormData((prev) => ({
        ...prev,
        region: displayName || prev.region,
        station_name: suggestedName || prev.station_name,
        station_code: suggestedName ? generateStationCode(suggestedName) : prev.station_code,
      }));
    } catch (err) {
      if (seq !== geocodeSeq.current) return;
      console.error('Gagal reverse-geocode', err);
      setFormError('Nama wilayah tidak bisa diambil otomatis. Isi kode dan nama secara manual.');
    } finally {
      if (seq === geocodeSeq.current) setIsLocating(false);
    }
  };

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const latitude = parseFloat(formData.latitude);
    const longitude = parseFloat(formData.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setFormError('Klik lokasi pada peta terlebih dahulu untuk mengisi koordinat.');
      return;
    }

    const payload = {
      station_code: formData.station_code,
      station_name: formData.station_name,
      latitude,
      longitude,
      region: formData.region ? formData.region : null,
      status_active: formData.status_active,
    };

    setSaving(true);
    setFormError('');
    try {
      if (isEditMode && currentId) {
        await api.put(`/api/admin/stations/${currentId}`, payload);
      } else {
        await api.post('/api/admin/stations', payload);
      }
      setIsModalOpen(false);
      setNotice({
        type: 'success',
        text: `Kecamatan ${payload.station_name} berhasil ${isEditMode ? 'diperbarui' : 'ditambahkan'}.`,
      });
      await fetchStations();
    } catch (err) {
      // Error ditampilkan di dalam modal supaya input user tidak hilang
      setFormError(getErrorMessage(err, 'Gagal menyimpan data kecamatan'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Station) => {
    if (deletingId) return;
    if (!window.confirm(`Hapus kecamatan "${item.station_name}"?`)) return;

    setDeletingId(item.id);
    setNotice(null);
    try {
      await api.delete(`/api/admin/stations/${item.id}`);
      setNotice({ type: 'success', text: `Kecamatan ${item.station_name} berhasil dihapus.` });
      await fetchStations();
    } catch (err) {
      setNotice({ type: 'error', text: getErrorMessage(err, 'Gagal menghapus kecamatan') });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ============ Header ============ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/5 dark:text-cyan-300">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
            </span>
            lokasi · batam
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            Kelola{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-amber-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-cyan-400 dark:to-amber-300">
              Kecamatan Pemantau
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manajemen titik lokasi kecamatan wilayah Batam.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-700 hover:to-cyan-700 hover:shadow-blue-600/35 active:scale-[0.99] dark:from-cyan-500 dark:to-indigo-500 dark:shadow-cyan-500/20 dark:hover:from-cyan-600 dark:hover:to-indigo-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.4" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Tambah Kecamatan
        </button>
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

      {/* ============ PETA UTAMA ============ */}
      {!loading && stations.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/40">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Sebaran Lokasi Kecamatan
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              {stations.length} titik
            </span>
          </div>
          <div className="relative z-0 h-80 w-full">
            <MapContainer center={BATAM_CENTER} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {stations.map((item) => (
                <Marker key={item.id} position={[item.latitude, item.longitude]}>
                  <Popup>
                    <div className="text-sm">
                      <strong className="block text-slate-900">{item.station_name}</strong>
                      <span className="mb-1 block text-slate-500">Kode: {item.station_code}</span>
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                          item.status_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.status_active ? 'AKTIF' : 'TIDAK AKTIF'}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* ============ Section label ============ */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          data kecamatan
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {stations.length} baris
        </span>
      </div>

      {/* ============ TABEL DATA ============ */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
                <th className="px-6 py-3 font-semibold">Kode</th>
                <th className="px-6 py-3 font-semibold">Nama Kecamatan</th>
                <th className="px-6 py-3 font-semibold">Koordinat (Lat, Long)</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700 dark:divide-slate-800 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic dark:text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin text-cyan-500" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                        <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      Memuat data kecamatan...
                    </div>
                  </td>
                </tr>
              ) : stations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic dark:text-slate-500">
                    Belum ada data kecamatan.
                  </td>
                </tr>
              ) : (
                stations.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
                        {item.station_code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-500 text-[11px] font-bold text-white">
                          {item.station_name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.station_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {item.latitude}, {item.longitude}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${
                          item.status_active
                            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300'
                            : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            item.status_active ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          aria-hidden="true"
                        />
                        {item.status_active ? 'aktif' : 'tidak aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-cyan-400/50 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:border-cyan-400/40 dark:hover:text-cyan-300"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
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

      {/* ============ MODAL FORM DENGAN PETA INTERAKTIF ============ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0b1220]">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600 ring-1 ring-cyan-500/25 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/25">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {isEditMode ? 'Edit Kecamatan' : 'Tambah Kecamatan Baru'}
                  </h3>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isEditMode ? 'perbarui data lokasi' : 'isi data lokasi baru'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                aria-label="Tutup"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 p-6">
              {formError && (
                <div
                  role="alert"
                  className="relative overflow-hidden rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/5 dark:text-rose-300"
                >
                  <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />
                  <div className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="leading-relaxed">{formError}</span>
                  </div>
                </div>
              )}

              {/* Peta Interaktif di dalam Modal */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Klik pada peta di bawah — kode, nama kecamatan, region, dan koordinat akan terisi otomatis:
                </label>
                <div className="relative h-56 w-full overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
                  <MapContainer
                    center={selectedCoord || BATAM_CENTER}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationSelector
                      position={selectedCoord}
                      setPosition={setSelectedCoord}
                      onSelectLocation={handleMapClickCoord}
                    />
                  </MapContainer>
                  {isLocating && (
                    <div className="absolute right-2 top-2 z-[1000] inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow ring-1 ring-slate-200 dark:bg-slate-800/95 dark:text-slate-300 dark:ring-slate-700">
                      <svg className="h-3.5 w-3.5 animate-spin text-cyan-500" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                        <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      Mengambil data wilayah otomatis...
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Kode Kecamatan (Otomatis dari Peta)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: BTM-NONGSA"
                    value={formData.station_code}
                    onChange={(e) => setFormData({ ...formData, station_code: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:bg-slate-800/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Nama Kecamatan (Otomatis dari Peta)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: Kecamatan Nongsa"
                    value={formData.station_name}
                    onChange={(e) => setFormData({ ...formData, station_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:bg-slate-800/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Latitude (Otomatis dari Peta)
                  </label>
                  <input
                    type="text"
                    readOnly
                    required
                    value={formData.latitude}
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Longitude (Otomatis dari Peta)
                  </label>
                  <input
                    type="text"
                    readOnly
                    required
                    value={formData.longitude}
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Region / Alamat Detail (Otomatis dari Peta)
                </label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:bg-slate-800/60"
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:bg-slate-800/50">
                <input
                  type="checkbox"
                  id="status_active"
                  checked={formData.status_active}
                  onChange={(e) => setFormData({ ...formData, status_active: e.target.checked })}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-800"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Status Aktif</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kecamatan ini ditampilkan sebagai lokasi pemantau.
                  </p>
                </div>
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800/60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || isLocating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-700 hover:to-cyan-700 hover:shadow-blue-600/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none dark:from-cyan-500 dark:to-indigo-500 dark:shadow-cyan-500/20 dark:hover:from-cyan-600 dark:hover:to-indigo-600"
                >
                  {saving ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                        <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Simpan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
// src/pages/ProfilePage.tsx
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { api, API_URL, uploadProfilePhoto, deleteProfilePhoto } from '../lib/api';

interface Profile {
  id: string;
  username: string;
  name: string;
  email: string;
  photo_url: string | null;
}

type Notice = { type: 'success' | 'error'; text: string } | null;

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // sama dengan batas backend (2 MB)
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Ambil pesan error dari respons backend ({error: "..."} atau {data: {error: "..."}}). */
function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as
      | { error?: string; message?: string; data?: { error?: string } }
      | undefined;
    return d?.data?.error ?? d?.error ?? d?.message ?? fallback;
  }
  return fallback;
}

const toAbsolute = (path: string | null) =>
  path ? (path.startsWith('http') ? path : `${API_URL}${path}`) : null;

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100';

const cardClass =
  'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0b1220]';

function Banner({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const ok = notice.type === 'success';
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`rounded-lg border px-3 py-2 text-sm ${
        ok
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
      }`}
    >
      {notice.text}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState('');
  const [imgBroken, setImgBroken] = useState(false);

  // Foto
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<Notice>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNotice, setPwNotice] = useState<Notice>(null);

  /* Muat profil */
  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/profile')
      .then((res) => {
        if (cancelled) return;
        setProfile(res.data.data as Profile);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Profil tidak bisa dimuat. Muat ulang halaman.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Bersihkan object URL preview */
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const resetPicker = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setPhotoNotice(null);
    if (!f) return;
    if (!PHOTO_TYPES.includes(f.type)) {
      setPhotoNotice({ type: 'error', text: 'Format foto harus JPEG, PNG, atau WebP.' });
      resetPicker();
      return;
    }
    if (f.size > MAX_PHOTO_BYTES) {
      setPhotoNotice({ type: 'error', text: 'Ukuran foto maksimal 2 MB.' });
      resetPicker();
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const uploadPhoto = async () => {
    if (!file || !profile) return;
    setPhotoBusy(true);
    setPhotoNotice(null);
    try {
      // Unggah lalu panggil /api/me. Helper ini memicu event sehingga
      // AuthContext (Navbar & Sidebar) langsung ikut berubah.
      const me = await uploadProfilePhoto(file);
      setProfile({ ...profile, photo_url: me.avatar ?? null });
      setImgBroken(false);
      resetPicker();
      setPhotoNotice({ type: 'success', text: 'Foto profil disimpan.' });
    } catch (err) {
      setPhotoNotice({ type: 'error', text: errorMessage(err, 'Foto gagal diunggah. Coba lagi.') });
    } finally {
      setPhotoBusy(false);
    }
  };

  const deletePhoto = async () => {
    if (!profile?.photo_url) return;
    if (!window.confirm('Hapus foto profil?')) return;
    setPhotoBusy(true);
    setPhotoNotice(null);
    try {
      await deleteProfilePhoto(); // memperbarui AuthContext otomatis
      setProfile({ ...profile, photo_url: null });
      setPhotoNotice({ type: 'success', text: 'Foto profil dihapus.' });
    } catch (err) {
      setPhotoNotice({ type: 'error', text: errorMessage(err, 'Foto gagal dihapus. Coba lagi.') });
    } finally {
      setPhotoBusy(false);
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwNotice(null);

    if (newPassword.length < 8) {
      setPwNotice({ type: 'error', text: 'Password baru minimal 8 karakter.' });
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setPwNotice({ type: 'error', text: 'Password baru maksimal 72 karakter.' });
      return;
    }
    if (newPassword === currentPassword) {
      setPwNotice({ type: 'error', text: 'Password baru harus berbeda dari password saat ini.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwNotice({ type: 'error', text: 'Konfirmasi password tidak sama.' });
      return;
    }

    setPwBusy(true);
    try {
      await api.put('/api/profile/password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      // Backend sudah mencabut semua sesi dan menghapus cookie refresh_token.
      // Bersihkan sisi client lalu arahkan ke login (reload penuh membersihkan semua state).
      setPwNotice({ type: 'success', text: 'Password diubah. Anda akan diarahkan ke halaman login.' });
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (err) {
      setPwNotice({ type: 'error', text: errorMessage(err, 'Password gagal diubah. Coba lagi.') });
      setPwBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <Banner notice={{ type: 'error', text: loadError }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8 text-sm text-slate-500 dark:text-slate-400" role="status">
        Memuat profil...
      </div>
    );
  }

  const shownPhoto = preview ?? toAbsolute(profile.photo_url);
  const showImage = shownPhoto && !imgBroken;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Profil saya</h1>

      {/* ============ Info + Foto ============ */}
      <section className={cardClass} aria-labelledby="foto-heading">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="shrink-0">
            {showImage ? (
              <img
                src={shownPhoto}
                alt={`Foto profil ${profile.name}`}
                onError={() => setImgBroken(true)}
                className="h-28 w-28 rounded-full border-2 border-cyan-500/30 object-cover"
              />
            ) : (
              <span
                aria-label={`Inisial ${profile.name}`}
                className="grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 text-3xl font-bold text-white"
              >
                {getInitials(profile.name || profile.username)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h2 id="foto-heading" className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                {profile.name}
              </h2>
              <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-500 dark:text-slate-400">Username</dt>
                <dd className="truncate text-slate-800 dark:text-slate-200">{profile.username}</dd>
                <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                <dd className="truncate text-slate-800 dark:text-slate-200">{profile.email}</dd>
              </dl>
            </div>

            <div className="space-y-2">
              <input
                ref={fileRef}
                id="photo-input"
                type="file"
                accept={PHOTO_TYPES.join(',')}
                onChange={onPickFile}
                disabled={photoBusy}
                className="sr-only"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="photo-input"
                  className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-cyan-400/60 hover:text-cyan-700 focus-within:ring-2 focus-within:ring-cyan-400/60 dark:border-slate-700 dark:text-slate-200 dark:hover:text-cyan-300"
                >
                  Pilih foto
                </label>

                {file && (
                  <>
                    <button
                      type="button"
                      onClick={uploadPhoto}
                      disabled={photoBusy}
                      className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-60"
                    >
                      {photoBusy ? 'Menyimpan...' : 'Simpan foto'}
                    </button>
                    <button
                      type="button"
                      onClick={resetPicker}
                      disabled={photoBusy}
                      className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      Batal
                    </button>
                  </>
                )}

                {!file && profile.photo_url && (
                  <button
                    type="button"
                    onClick={deletePhoto}
                    disabled={photoBusy}
                    className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    {photoBusy ? 'Menghapus...' : 'Hapus foto'}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">JPEG, PNG, atau WebP. Maksimal 2 MB.</p>
              <Banner notice={photoNotice} />
            </div>
          </div>
        </div>
      </section>

      {/* ============ Ganti password ============ */}
      <section className={cardClass} aria-labelledby="pw-heading">
        <h2 id="pw-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Ganti password
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Setelah password diganti, Anda keluar dari semua perangkat dan harus login ulang.
        </p>

        <form onSubmit={submitPassword} className="mt-4 space-y-4" noValidate>
          <div>
            <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password saat ini
            </label>
            <input
              id="current-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={pwBusy}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password baru
            </label>
            <input
              id="new-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={pwBusy}
              required
              minLength={8}
              aria-describedby="new-password-hint"
              className={inputClass}
            />
            <p id="new-password-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Minimal 8 karakter, maksimal 72.
            </p>
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Ulangi password baru
            </label>
            <input
              id="confirm-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={pwBusy}
              required
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showPw}
              onChange={(e) => setShowPw(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            />
            Tampilkan password
          </label>

          <Banner notice={pwNotice} />

          <button
            type="submit"
            disabled={pwBusy || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pwBusy ? 'Menyimpan...' : 'Ganti password'}
          </button>
        </form>
      </section>
    </div>
  );
}
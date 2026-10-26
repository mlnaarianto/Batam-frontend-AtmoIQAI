import { useEffect, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';

// ID dari Golang bisa berupa string atau array of bytes (UUID)
type RawId = string | number[];

interface RoleItem {
  id?: RawId;
  ID?: RawId;
  name: string;
  description?: string;
}

interface UserItem {
  id?: RawId;
  ID?: RawId;
  username: string;
  email?: string;
  roles?: RoleItem[];
}

// Helper untuk menangani jika ID dari Golang dikirim berupa Array of Bytes (UUID)
const formatSafeId = (id: RawId | undefined): string => {
  if (Array.isArray(id) && id.length === 16) {
    const hex = id.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return String(id ?? '');
};

const getId = (item: { id?: RawId; ID?: RawId }) => formatSafeId(item.id ?? item.ID);

function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 403) return 'Kamu tidak punya izin untuk aksi ini.';
    const d = err.response?.data;
    return d?.error || d?.message || fallback;
  }
  return fallback;
}

export default function RbacPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [allRoles, setAllRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRbacData = async () => {
    setLoadError('');
    try {
      // Token & auto-refresh ditangani interceptor di lib/api.ts
      const response = await api.get('/api/admin/rbac');
      const resData = response.data?.data?.data || response.data?.data || response.data;
      setUsers(resData.users || []);
      setAllRoles(resData.roles || []);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Gagal mengambil data RBAC.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRbacData();
  }, []);

  const handleOpenEdit = (user: UserItem) => {
    setNotice(null);
    setSelectedUser(user);
    setSelectedRoleIds((user.roles ?? []).map(getId));
  };

  const handleSaveRoles = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser || saving) return;

    setSaving(true);
    setNotice(null);
    try {
      await api.put(`/api/admin/users/${getId(selectedUser)}/roles`, {
        role_ids: selectedRoleIds, // array string UUID
      });
      setNotice({ type: 'success', text: `Role ${selectedUser.username} berhasil diperbarui.` });
      setSelectedUser(null);
      await fetchRbacData();
    } catch (err) {
      console.error('DETAIL ERROR:', isAxiosError(err) ? err.response?.data : err);
      setNotice({ type: 'error', text: getErrorMessage(err, 'Gagal memperbarui role.') });
    } finally {
      setSaving(false);
    }
  };

  const handleCheckboxChange = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  /* ============ Loading state ============ */
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/5 dark:text-cyan-300">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
            </span>
            rbac
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            Kelola{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-amber-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-cyan-400 dark:to-amber-300">
              RBAC
            </span>
          </h1>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-[#0b1220] dark:text-slate-400">
          <svg className="h-4 w-4 animate-spin text-cyan-500" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
            <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <span className="font-medium">Memuat data sistem...</span>
        </div>
      </div>
    );
  }

  /* ============ Error state ============ */
  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/5 dark:text-cyan-300">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
            </span>
            rbac
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            Kelola{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-amber-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-cyan-400 dark:to-amber-300">
              RBAC
            </span>
          </h1>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div
          role="alert"
          className="relative overflow-hidden rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/5 dark:text-rose-300"
        >
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />
          <div className="flex items-start gap-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-medium leading-relaxed">{loadError}</p>
              <button
                onClick={() => {
                  setLoading(true);
                  fetchRbacData();
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200 transition-colors hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30 dark:hover:bg-rose-500/20"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Coba lagi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            rbac
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            Kelola{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-amber-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-cyan-400 dark:to-amber-300">
              RBAC
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola daftar pengguna dan hak akses peran (Role) sistem.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

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

      {/* ============ Section label ============ */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          pengguna · role
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {users.length} user · {allRoles.length} role
        </span>
      </div>

      {/* ============ Tabel Pengguna ============ */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/40">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Daftar Pengguna &amp; Role
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
                <th className="px-6 py-3">Username</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role Aktif</th>
                <th className="px-6 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700 dark:divide-slate-800 dark:text-slate-300">
              {users.length > 0 ? (
                users.map((user, index) => (
                  <tr
                    key={getId(user) || index}
                    className="transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-500 text-[11px] font-bold text-white">
                          {user.username.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {user.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {user.email || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role.name}
                              className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300"
                            >
                              {role.name}
                            </span>
                          ))
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400 italic dark:text-slate-500">
                            tanpa role
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-cyan-400/50 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:border-cyan-400/40 dark:hover:text-cyan-300"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Role
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic dark:text-slate-500">
                    Tidak ada data pengguna ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ Form Edit Role ============ */}
      {selectedUser && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
          {/* Header form */}
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600 ring-1 ring-cyan-500/25 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/25">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V7l8-4z" />
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Edit Role untuk{' '}
                  <span className="bg-gradient-to-r from-cyan-600 to-amber-500 bg-clip-text text-transparent dark:from-cyan-300 dark:to-amber-300">
                    {selectedUser.username}
                  </span>
                </h3>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  pilih role yang ingin diberikan
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveRoles} className="p-6">
            <div className="mb-6 space-y-2">
              {allRoles.map((role) => {
                const roleId = getId(role);
                const checked = selectedRoleIds.includes(roleId);
                return (
                  <label
                    key={roleId}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? 'border-cyan-500/40 bg-cyan-50/70 dark:border-cyan-400/40 dark:bg-cyan-500/10'
                        : 'border-slate-200 hover:border-cyan-400/30 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-cyan-400/30 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleCheckboxChange(roleId)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-800"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {role.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {role.description || 'Tidak ada deskripsi'}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
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
                    Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
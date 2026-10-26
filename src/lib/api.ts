import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// ---------- Tipe & helper user ----------
export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  email?: string;
  avatar?: string; // URL absolut
}

const USER_EVENT = 'auth:user-updated';

export function resolvePhotoUrl(p?: string | null): string | undefined {
  if (!p) return undefined;
  return p.startsWith('http') ? p : `${API_URL}${p}`;
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: User) {
  localStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new CustomEvent(USER_EVENT, { detail: user }));
}

export function onUserUpdated(cb: (u: User | null) => void) {
  const handler = () => cb(getStoredUser());
  window.addEventListener(USER_EVENT, handler);
  return () => window.removeEventListener(USER_EVENT, handler);
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new CustomEvent(USER_EVENT));
}

// Dipakai oleh /login dan /refresh (respons: id, username, name, role, photo_url, token).
// Data lama (mis. email) dipertahankan supaya tidak hilang.
export function saveSession(d: any) {
  localStorage.setItem('token', d.token);
  const prev = getStoredUser();
  saveUser({
    ...(prev?.id === d.id ? prev : {}),
    id: d.id,
    username: d.username,
    name: d.name,
    role: d.role,
    avatar: resolvePhotoUrl(d.photo_url),
  });
}

// ---------- Axios instance ----------
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/refresh`, null, { withCredentials: true })
      .then((res) => {
        saveSession(res.data.data);
        return res.data.data.token as string;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const url = original?.url ?? '';
    const isAuthCall = ['/login', '/refresh', '/logout'].some((p) => url.includes(p));

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        clearSession();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ---------- Endpoint auth & profil ----------

// GET /api/me: sumber data user lengkap (termasuk email).
export async function fetchMe(): Promise<User> {
  const res = await api.get('/api/me');
  const d = res.data.data;
  const user: User = {
    id: d.id,
    username: d.username,
    name: d.name,
    email: d.email,
    role: d.role,
    avatar: resolvePhotoUrl(d.photo_url),
  };
  saveUser(user);
  return user;
}

export async function uploadProfilePhoto(file: File): Promise<User> {
  const form = new FormData();
  form.append('photo', file); // nama field harus 'photo'
  await api.post('/api/profile/photo', form); // jangan set Content-Type manual
  return fetchMe();
}

export async function deleteProfilePhoto(): Promise<User> {
  await api.delete('/api/profile/photo');
  return fetchMe();
}

// Backend mencabut SEMUA sesi setelah ganti password, jadi client harus keluar.
export async function changePassword(input: {
  current_password: string;
  new_password: string;
  confirm_password: string;
}) {
  await api.put('/api/profile/password', input);
  clearSession();
  window.location.href = '/login';
}

export async function logout() {
  try {
    await api.post('/logout');
  } catch {
    // tetap bersihkan sisi client
  }
  clearSession();
  window.location.href = '/login';
}
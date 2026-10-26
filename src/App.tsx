// src/App.tsx
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AppLayout from './components/AppLayout';
import DashboardPage from './pages/DashboardPage';
import StationsPage from './pages/StationsPage';
import WeatherPredictionsPage from './pages/WeatherPredictionsPage';
import RbacPage from './pages/RbacPage';
import RolesPermissionsPage from './pages/RolesPermissionsPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    if (!token) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* ========================================== */}
        {/* RUTE PUBLIK                                */}
        {/* ========================================== */}
        <Route path="/" element={<Navigate to="/public/weather" replace />} />
        <Route path="/login" element={token ? <Navigate to="/admin/dashboard" replace /> : <LoginPage />} />
        <Route path="/public/weather" element={<div className="p-4 md:p-8 bg-slate-50 min-h-screen"><WeatherPredictionsPage /></div>} />

        {/* ========================================== */}
        {/* RUTE TERPROTEKSI (Butuh Login)             */}
        {/* Menggunakan Pathless Route agar layout tetap sama */}
        {/* ========================================== */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          
          {/* RUTE ADMIN */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/stations" element={<StationsPage />} />
          <Route path="/admin/weather-predictions" element={<WeatherPredictionsPage />} />
          <Route path="/admin/rbac" element={<RbacPage />} />
          <Route path="/admin/roles-permissions" element={<RolesPermissionsPage />} />

          {/* RUTE PROFIL (Di luar prefix /admin, tapi tetap di dalam Layout) */}
          <Route path="/profile" element={<ProfilePage />} />
          
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/public/weather" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
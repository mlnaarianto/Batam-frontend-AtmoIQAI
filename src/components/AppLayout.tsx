import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';

export default function AppLayout() {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 font-sans dark:bg-[#070b12]">
      {/* Navbar full width di atas (persis Blade) */}
      <Navbar
        onToggleMobileSidebar={() => setMobileOpen((v) => !v)}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Overlay mobile */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar: fixed di mobile, relative di md+ */}
        <div
          className={`
            fixed left-0 top-14 z-40 h-[calc(100vh-56px)] w-64 flex-shrink-0 overflow-hidden
            transition-all duration-300
            md:relative md:top-0 md:h-full md:translate-x-0
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
            ${sidebarCollapsed ? 'md:w-0' : 'md:w-64'}
          `}
        >
          <Sidebar onLogout={handleLogout} />
        </div>

        {/* Konten utama */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6 sm:p-8">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
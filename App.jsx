import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import ToastContainer from './components/Toast';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import ShipmentsPage from './pages/ShipmentsPage';
import { InventoryPage, NetworkPage } from './pages/PlaceholderPages';

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-ink-500 text-sm">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          Loading Lume…
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-ink-900">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-14 bg-ink-800 border-b border-ink-700 flex items-center px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse-slow" />
            <span>Live · WH-001 Chennai Central</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-500">
            <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span className="text-ink-700">|</span>
            <span className="font-mono">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/"          element={<DashboardPage />} />
            <Route path="/map"       element={<MapPage />} />
            <Route path="/shipments" element={<ShipmentsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/network"   element={<NetworkPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*"     element={<ProtectedLayout />} />
      </Routes>
    </AuthProvider>
  );
}

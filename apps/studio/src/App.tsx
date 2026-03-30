import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { DriverProvider, useDriver } from './context/DriverContext';
import { Dashboard } from './pages/Dashboard';
import { Effects } from './pages/Effects';
import { Audio } from './pages/Audio';
import { Terminal } from './pages/Terminal';
import { Presets } from './pages/Presets';
import { Mapper } from './pages/Mapper';

function ConnectionIndicator() {
  const { status } = useDriver();
  const color = status === 'connected' ? 'var(--secondary)' 
    : status === 'connecting' ? 'var(--primary)' 
    : '#FF0055';
  return (
    <div className="flex items-center gap-2" style={{ padding: '12px 16px', marginTop: 'auto' }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
        animation: status === 'connecting' ? 'pulse-glow 1.5s ease-in-out infinite' : undefined,
      }} />
      <span className="font-mono text-xs text-muted-foreground" style={{ textTransform: 'uppercase' }}>
        {status}
      </span>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full" style={{ height: '100vh' }}>
      <nav className="studio-nav">
        <div className="studio-nav-header">
          <span className="glow-text font-bold">vanda</span>LED
        </div>
        <div className="flex-col gap-2">
          <NavLink to="/" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 6v9h5v-5h4v5h5V6L8 1z"/></svg>
            Dashboard
          </NavLink>
          <NavLink to="/mapper" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z"/></svg>
            Pixel Mapper
          </NavLink>
          <NavLink to="/effects" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0l2 5h5l-4 3 1.5 5L8 10 3.5 13 5 8 1 5h5z"/></svg>
            Effects
          </NavLink>
          <NavLink to="/audio" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 6v4h3l4 4V2L6 6H3z"/></svg>
            Audio
          </NavLink>
          <NavLink to="/terminal" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2h14v12H1V2zm1 2v8h12V4H2zm2 2l3 2-3 2V6zm5 4h4v1H9v-1z"/></svg>
            Terminal
          </NavLink>
          <NavLink to="/presets" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h12v2H2v-2z"/></svg>
            Presets
          </NavLink>
        </div>
        <ConnectionIndicator />
      </nav>
      <main className="main-content">
        <div className="glass-panel" style={{ minHeight: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DriverProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mapper" element={<Mapper />} />
            <Route path="/effects" element={<Effects />} />
            <Route path="/audio" element={<Audio />} />
            <Route path="/terminal" element={<Terminal />} />
            <Route path="/presets" element={<Presets />} />
          </Routes>
        </Layout>
      </DriverProvider>
    </BrowserRouter>
  );
}

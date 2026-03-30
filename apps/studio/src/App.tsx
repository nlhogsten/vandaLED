import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { DriverProvider, useDriver } from './context/DriverContext';
import { Control } from './pages/Control';
import { Presets } from './pages/Presets';
import { Mapper } from './pages/Mapper';
import { TerminalDrawer } from './components/TerminalDrawer';

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
    <div className="flex w-full overflow-hidden relative" style={{ height: '100vh' }}>
      <nav className="studio-nav">
        <div className="studio-nav-header">
          <span className="glow-text font-bold">vanda</span>LED
        </div>
        <div className="flex flex-col gap-2">
          <NavLink to="/" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 6v9h5v-5h4v5h5V6L8 1z"/></svg>
            Control
          </NavLink>
          <NavLink to="/mapper" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H9zM9 9h6v6H9z"/></svg>
            Pixel Mapper
          </NavLink>
          <NavLink to="/presets" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h12v2H2v-2z"/></svg>
            Presets
          </NavLink>
        </div>
        <ConnectionIndicator />
      </nav>
      <main className="main-content relative">
        <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </main>
      <TerminalDrawer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DriverProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Control />} />
            <Route path="/mapper" element={<Mapper />} />
            <Route path="/presets" element={<Presets />} />
          </Routes>
        </Layout>
      </DriverProvider>
    </BrowserRouter>
  );
}

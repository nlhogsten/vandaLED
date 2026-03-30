import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { DriverProvider, useDriver } from './context/DriverContext';
import { Control } from './pages/Control';
import { Presets } from './pages/Presets';
import { Mapper } from './pages/Mapper';
import { TerminalDrawer } from './components/TerminalDrawer';
import { LivePreviewPanel } from './components/LivePreviewPanel';
import { HARDWARE_LAYOUT_EVENT, loadHardwareLayout } from './lib/mapper';

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
  const [navCollapsed, setNavCollapsed] = React.useState(false);
  const [activePanel, setActivePanel] = React.useState<'preview' | 'terminal' | null>('preview');

  const togglePanel = (panel: 'preview' | 'terminal') => {
    setActivePanel((current) => current === panel ? null : panel);
  };

  return (
    <div className={`studio-shell ${navCollapsed ? 'nav-collapsed' : ''}`}>
      <nav className="studio-nav">
        <div className="studio-nav-header">
          <span className="glow-text font-bold">vanda</span>LED
          <button className="studio-nav-collapse" onClick={() => setNavCollapsed((value) => !value)}>
            {navCollapsed ? '→' : '←'}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <NavLink to="/" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 6v9h5v-5h4v5h5V6L8 1z"/></svg>
            <span>Control</span>
          </NavLink>
          <NavLink to="/mapper" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H9zM9 9h6v6H9z"/></svg>
            <span>Pixel Mapper</span>
          </NavLink>
          <NavLink to="/presets" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h12v2H2v-2z"/></svg>
            <span>Presets</span>
          </NavLink>
        </div>
        <div className="studio-nav-section">
          <button className={`studio-nav-item studio-nav-panel-btn ${activePanel === 'preview' ? 'active' : ''}`} onClick={() => togglePanel('preview')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 4h14v8H1zM3 6h2v4H3zm4 0h2v4H7zm4 0h2v4h-2z"/></svg>
            <span>Live Preview</span>
          </button>
          <button className={`studio-nav-item studio-nav-panel-btn ${activePanel === 'terminal' ? 'active' : ''}`} onClick={() => togglePanel('terminal')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v10H2zM4 6l2 2-2 2m4 0h4"/></svg>
            <span>Terminal</span>
          </button>
        </div>
        <ConnectionIndicator />
      </nav>
      <main className="main-content relative">
        <div className="page-shell">
          {children}
        </div>
      </main>
      <div className={`bottom-dock ${activePanel ? 'open' : ''}`}>
        <button className="bottom-dock-toggle" onClick={() => setActivePanel((current) => current ? null : 'preview')}>
          {activePanel ? '↓ Close Panel' : '↑ Open Panel'}
        </button>
        {activePanel === 'preview' ? <LivePreviewPanel /> : null}
        {activePanel === 'terminal' ? <TerminalDrawer /> : null}
      </div>
    </div>
  );
}

function LayoutSyncBridge() {
  const { status, send } = useDriver();

  React.useEffect(() => {
    const sync = () => {
      send('LAYOUT_SYNC', loadHardwareLayout());
    };

    if (status === 'connected') {
      sync();
    }

    window.addEventListener(HARDWARE_LAYOUT_EVENT, sync);
    return () => window.removeEventListener(HARDWARE_LAYOUT_EVENT, sync);
  }, [send, status]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <DriverProvider>
        <LayoutSyncBridge />
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

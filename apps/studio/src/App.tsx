import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full" style={{ height: '100vh' }}>
      <nav className="studio-nav">
        <div className="studio-nav-header">
          <span className="glow-text font-bold">vanda</span>LED
        </div>
        <div className="flex-col gap-2">
          <NavLink to="/" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/mapper" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            Pixel Mapper
          </NavLink>
          <NavLink to="/effects" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            Effects
          </NavLink>
          <NavLink to="/audio" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            Audio
          </NavLink>
          <NavLink to="/terminal" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            Terminal
          </NavLink>
          <NavLink to="/presets" className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
            Presets
          </NavLink>
        </div>
      </nav>
      <main className="main-content">
        <div className="glass-panel" style={{ minHeight: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

function Dashboard() { 
  return (
    <div>
      <h2>Dashboard</h2>
      <p className="mb-1 text-lg">System Status Overview</p>
      <div className="studio-grid" style={{ marginTop: '2rem' }}>
        <div className="dashboard-card">
          <h3 className="text-primary font-mono mb-1">Controller</h3>
          <p>Connected / 60 FPS</p>
        </div>
        <div className="dashboard-card">
          <h3 className="text-primary font-mono mb-1">Active Effect</h3>
          <p>Plasma Glow</p>
        </div>
      </div>
    </div>
  ); 
}
function Mapper() { return <div><h2>Pixel Mapper</h2><p>Canvas-based tube layout editor.</p></div>; }
function Effects() { return <div><h2>Effects</h2><p>Color picker, effect selector.</p></div>; }
function Audio() { return <div><h2>Audio</h2><p>Real-time frequency visualizer.</p></div>; }
function Terminal() { return <div><h2>Terminal</h2><p>Scrollable log of all WebSocket messages.</p></div>; }
function Presets() { return <div><h2>Presets</h2><p>Save/load named presets.</p></div>; }

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

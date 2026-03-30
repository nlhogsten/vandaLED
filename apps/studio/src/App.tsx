import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <nav style={{ width: '200px', borderRight: '1px solid #333', padding: '20px' }}>
        <h2 style={{ color: '#00F5FF', marginBottom: '20px' }}>vandaLED Studio</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <li><Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Dashboard</Link></li>
          <li><Link to="/mapper" style={{ color: 'white', textDecoration: 'none' }}>Pixel Mapper</Link></li>
          <li><Link to="/effects" style={{ color: 'white', textDecoration: 'none' }}>Effects</Link></li>
          <li><Link to="/audio" style={{ color: 'white', textDecoration: 'none' }}>Audio</Link></li>
          <li><Link to="/terminal" style={{ color: 'white', textDecoration: 'none' }}>Terminal</Link></li>
          <li><Link to="/presets" style={{ color: 'white', textDecoration: 'none' }}>Presets</Link></li>
        </ul>
      </nav>
      <main style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}

function Dashboard() { return <div><h1>Dashboard</h1><p>Status overview & quick controls.</p></div>; }
function Mapper() { return <div><h1>Pixel Mapper</h1><p>Canvas-based tube layout editor.</p></div>; }
function Effects() { return <div><h1>Effects</h1><p>Color picker, effect selector.</p></div>; }
function Audio() { return <div><h1>Audio</h1><p>Real-time frequency visualizer.</p></div>; }
function Terminal() { return <div><h1>Terminal</h1><p>Scrollable log of all WebSocket messages.</p></div>; }
function Presets() { return <div><h1>Presets</h1><p>Save/load named presets.</p></div>; }

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

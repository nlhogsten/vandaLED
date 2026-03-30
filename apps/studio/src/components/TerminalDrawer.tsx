import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDriver } from '../context/DriverContext';
import { TerminalLine } from '@vandaled/ui-components';

interface LogEntry {
  id: number;
  timestamp: number;
  type: 'info' | 'error' | 'send' | 'receive';
  text: string;
}

let nextId = 0;

export function TerminalDrawer() {
  const { status, send, onMessage } = useDriver();
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: nextId++, timestamp: Date.now(), type: 'info', text: 'Terminal initialized.' },
  ]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry['type'], text: string) => {
    // Only keep last 100 logs
    setLogs(prev => [...prev.slice(-99), { id: nextId++, timestamp: Date.now(), type, text }]);
  }, []);

  useEffect(() => {
    const unsub = onMessage((msg) => {
      // ignore PIXEL_FRAME as it floods the log
      if (msg.type !== 'PIXEL_FRAME') {
        addLog('receive', JSON.stringify(msg));
      }
    });
    return unsub;
  }, [onMessage, addLog]);

  useEffect(() => {
    addLog('info', `Driver: ${status}`);
  }, [status, addLog]);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    addLog('send', trimmed);
    try {
      const parsed = JSON.parse(trimmed);
      send(parsed.type ?? 'RAW', parsed.payload ?? parsed);
    } catch {
      send('RAW', { text: trimmed });
    }
    setInput('');
  };

  return (
    <div className={`terminal-drawer ${isOpen ? 'open' : ''}`}>
      <button className="terminal-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '↓ Close Terminal' : '↑ Open Terminal'}
      </button>
      
      <div className="terminal-drawer-content">
        <div ref={scrollRef} className="terminal-log">
          {logs.map((entry) => (
            <TerminalLine key={entry.id} timestamp={entry.timestamp} type={entry.type} text={entry.text} />
          ))}
        </div>
        <div className="terminal-input-row" style={{ marginTop: '0', borderTop: '1px solid var(--border)', background: '#000', padding: '8px' }}>
          <span className="terminal-prompt">{'>'}</span>
          <input
            type="text"
            className="terminal-input"
            style={{ border: 'none', background: 'transparent' }}
            placeholder='Type JSON command, e.g. {"type":"PING"}'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          />
          <button className="action-btn" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}

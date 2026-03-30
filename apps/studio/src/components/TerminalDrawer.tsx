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
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry['type'], text: string) => {
    // Only keep last 100 logs
    setLogs(prev => [...prev.slice(-99), { id: nextId++, timestamp: Date.now(), type, text }]);
  }, []);

  useEffect(() => {
    const unsub = onMessage((msg) => {
      const typedMsg = msg as { type?: string };
      if (typedMsg.type !== 'PIXEL_FRAME') {
        addLog('receive', JSON.stringify(msg));
      }
    });
    return unsub;
  }, [onMessage, addLog]);

  useEffect(() => {
    addLog('info', `Driver: ${status}`);
  }, [status, addLog]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

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
    <div className="dock-panel dock-terminal">
      <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
        <div className="card-label mb-0">Terminal</div>
        <span className="font-mono text-xs text-muted-foreground">{logs.length} logs</span>
      </div>
      <div ref={scrollRef} className="terminal-log">
        {logs.map((entry) => (
          <TerminalLine key={entry.id} timestamp={entry.timestamp} type={entry.type} text={entry.text} />
        ))}
      </div>
      <div className="terminal-input-row dock-terminal-input">
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
  );
}

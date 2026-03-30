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

export function Terminal() {
  const { status, send, onMessage } = useDriver();
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: nextId++, timestamp: Date.now(), type: 'info', text: 'Terminal initialized.' },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry['type'], text: string) => {
    setLogs(prev => [...prev.slice(-200), { id: nextId++, timestamp: Date.now(), type, text }]);
  }, []);

  // Subscribe to all incoming messages
  useEffect(() => {
    const unsub = onMessage((msg) => {
      addLog('receive', JSON.stringify(msg));
    });
    return unsub;
  }, [onMessage, addLog]);

  // Track connection status changes
  useEffect(() => {
    addLog('info', `Driver: ${status}`);
  }, [status, addLog]);

  // Auto-scroll
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
      // Send as raw text command
      send('RAW', { text: trimmed });
    }

    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 144px)' }}>
      <h2>Terminal</h2>
      <p className="mb-1 text-lg" style={{ marginBottom: '1rem' }}>WebSocket message log</p>

      {/* Log Area */}
      <div
        ref={scrollRef}
        className="terminal-log"
      >
        {logs.map((entry) => (
          <TerminalLine
            key={entry.id}
            timestamp={entry.timestamp}
            type={entry.type}
            text={entry.text}
          />
        ))}
      </div>

      {/* Input Area */}
      <div className="terminal-input-row">
        <span className="terminal-prompt">{'>'}</span>
        <input
          type="text"
          className="terminal-input"
          placeholder='Type JSON command, e.g. {"type":"PING"}'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
        />
        <button className="action-btn" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

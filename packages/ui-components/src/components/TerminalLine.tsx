import React from 'react';
import { cn } from '../lib/utils';

export interface TerminalLineProps {
  timestamp: number;
  type: 'info' | 'error' | 'send' | 'receive';
  text: string;
}

export function TerminalLine({ timestamp, type, text }: TerminalLineProps) {
  const timeStr = new Date(timestamp).toLocaleTimeString();
  
  const typeColors = {
    info: 'text-blue-400',
    error: 'text-red-400',
    send: 'text-green-400',
    receive: 'text-yellow-400'
  };

  return (
    <div className="font-mono text-sm mb-1 flex gap-2">
      <span className="text-muted-foreground opacity-50">[{timeStr}]</span>
      <span className={cn("uppercase text-xs", typeColors[type])}>[{type}]</span>
      <span className="text-foreground">{text}</span>
    </div>
  );
}

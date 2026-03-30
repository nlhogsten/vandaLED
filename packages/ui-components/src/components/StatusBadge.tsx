import React from 'react';
import { cn } from '../lib/utils';

export type ConnectionStatus = 'connected' | 'disconnected' | 'emulating';

interface StatusBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorMap = {
    connected: 'bg-green-500 text-black',
    disconnected: 'bg-red-500 text-white',
    emulating: 'bg-cyan-400 text-black'
  };

  return (
    <span className={cn("px-2 py-1 text-xs font-bold rounded", colorMap[status], className)}>
      {status.toUpperCase()}
    </span>
  );
}

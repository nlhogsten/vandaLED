import React, { createContext, useContext } from 'react';
import { useDriverSocket, UseDriverSocket } from '../hooks/useDriverSocket';

const DriverContext = createContext<UseDriverSocket | null>(null);

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const socket = useDriverSocket();
  return (
    <DriverContext.Provider value={socket}>
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver(): UseDriverSocket {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error('useDriver must be used within <DriverProvider>');
  return ctx;
}

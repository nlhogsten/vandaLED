import React from 'react';
import { cn } from '../lib/utils';

export interface PixelDotProps {
  r: number;
  g: number;
  b: number;
  className?: string;
  size?: number;
}

export function PixelDot({ r, g, b, className, size = 12 }: PixelDotProps) {
  return (
    <div 
      className={cn("rounded-full bg-black border border-muted", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: `rgb(${r},${g},${b})`
      }}
    />
  );
}

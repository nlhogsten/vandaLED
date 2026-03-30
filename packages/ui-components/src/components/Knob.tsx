import React from 'react';
import { cn } from '../lib/utils';

interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange?: (val: number) => void;
  className?: string;
}

export function Knob({ value, min = 0, max = 100, onChange, className }: KnobProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className={cn("relative w-16 h-16 rounded-full border-2 border-primary bg-background", className)}>
      <div 
        className="absolute top-1/2 left-1/2 w-1 h-1/2 bg-primary origin-bottom"
        style={{ transform: `translate(-50%, -100%) rotate(${percentage * 2.7 - 135}deg)` }}
      />
    </div>
  );
}

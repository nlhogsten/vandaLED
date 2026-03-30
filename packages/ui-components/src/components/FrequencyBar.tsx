import React from 'react';
import { cn } from '../lib/utils';

interface FrequencyBarProps {
  value: number; // 0 to 1
  className?: string;
  color?: string;
}

export function FrequencyBar({ value, className, color = 'bg-primary' }: FrequencyBarProps) {
  return (
    <div className={cn("w-4 bg-muted h-32 flex flex-col justify-end", className)}>
      <div 
        className={cn("w-full transition-all duration-75", color)} 
        style={{ height: `${value * 100}%` }}
      />
    </div>
  );
}

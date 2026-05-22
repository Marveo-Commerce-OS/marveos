import React from 'react';

export function GlassCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`backdrop-blur-lg bg-white/10 border border-white/20 rounded-3xl shadow-xl ${className}`}
      style={{ boxShadow: '0 8px 32px 0 rgba(16,40,80,0.25), 0 1.5px 8px 0 rgba(0,0,0,0.10)' }}
    >
      {children}
    </div>
  );
}

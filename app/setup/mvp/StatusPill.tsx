import React from 'react';

export function StatusPill({ status }: { status: 'pending' | 'running' | 'done' | 'failed' }) {
  const map = {
    pending: 'bg-slate-700 text-slate-300',
    running: 'bg-blue-800 text-blue-200 animate-pulse',
    done: 'bg-emerald-800 text-emerald-200',
    failed: 'bg-red-800 text-red-200',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold shadow ${map[status]}`}>{status}</span>
  );
}

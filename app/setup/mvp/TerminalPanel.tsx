import React, { useEffect, useRef } from 'react';

export function TerminalPanel({ logs, running }: { logs: string[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [logs]);
  return (
    <div className="bg-black/80 border border-blue-900 rounded-2xl p-4 font-mono text-xs text-blue-200 h-48 overflow-y-auto shadow-inner" ref={ref}>
      {logs.map((line, i) => (
        <div key={i} className={running && i === logs.length - 1 ? 'animate-pulse' : ''}>
          {line}
        </div>
      ))}
    </div>
  );
}

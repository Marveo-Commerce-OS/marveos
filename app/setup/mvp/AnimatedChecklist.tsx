import React from 'react';

const checklist = [
  'Creating secure workspace',
  'Preparing business profile',
  'Generating workspace access',
  'Preparing launch checklist',
];

export function AnimatedChecklist({ progress }: { progress: number }) {
  return (
    <ul className="space-y-3 mt-4">
      {checklist.map((item, i) => (
        <li key={item} className="flex items-center gap-3">
          <span className={`w-6 h-6 flex items-center justify-center rounded-full border-2 transition-all duration-500
            ${i < progress ? 'bg-emerald-500 border-emerald-400 text-white shadow' :
              i === progress ? 'bg-blue-700 border-blue-400 text-white animate-pulse' :
              'bg-slate-800 border-slate-600 text-slate-400'}`}
          >
            {i < progress ? (
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path stroke="currentColor" strokeWidth="2" d="M4 8.5l3 3 5-5"/></svg>
            ) : i === progress ? (
              <span className="w-2 h-2 bg-white rounded-full block"></span>
            ) : null}
          </span>
          <span className={`text-sm font-medium ${i <= progress ? 'text-white' : 'text-slate-500'}`}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

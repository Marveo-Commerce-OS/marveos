import React from 'react';

export function AnimatedProgressRail({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="w-full py-4">
      <ol className="flex items-start w-full">
        {steps.map((step, i) => (
          <li key={step} className="flex-1 min-w-0">
            <div className="flex items-center">
              {i > 0 && (
                <div
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= currentStep ? 'bg-blue-500' : 'bg-slate-700'}`}
                />
              )}
              <div
                className={`mx-2 w-8 h-8 shrink-0 flex items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  i < currentStep
                    ? 'bg-blue-700 border-blue-400 text-white shadow-lg'
                    : i === currentStep
                      ? 'bg-gradient-to-br from-blue-800 to-blue-600 border-blue-400 text-white shadow-xl animate-pulse'
                      : 'bg-slate-800 border-slate-600 text-slate-400'
                }`}
              >
                <span className="font-bold text-base">{i + 1}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${i < currentStep ? 'bg-blue-500' : 'bg-slate-700'}`}
                />
              )}
            </div>
            <p
              className={`mt-2 text-center text-[11px] md:text-xs font-semibold uppercase tracking-wider truncate px-1 ${
                i <= currentStep ? 'text-white' : 'text-slate-500'
              }`}
              title={step}
            >
              {step}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

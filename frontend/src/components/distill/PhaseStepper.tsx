import type { PhaseStatus } from '@/types';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface PhaseStepperProps {
  phases: PhaseStatus[];
}

function PhaseDot({ status }: { status: PhaseStatus['status'] }) {
  if (status === 'done') {
    return (
      <CheckCircle2
        size={20}
        strokeWidth={2.5}
        style={{ color: 'var(--color-ks-success)' }}
      />
    );
  }

  if (status === 'active') {
    return (
      <div className="relative flex items-center justify-center">
        {/* Pulse ring */}
        <span
          className="absolute inline-flex h-5 w-5 rounded-full ks-animate-pulse"
          style={{ backgroundColor: 'var(--color-ks-primary)', opacity: 0.3 }}
        />
        <Loader2
          size={20}
          strokeWidth={2.5}
          className="ks-animate-spin"
          style={{ color: 'var(--color-ks-primary)' }}
        />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Circle
        size={20}
        strokeWidth={2.5}
        style={{ color: 'var(--color-ks-error)' }}
      />
    );
  }

  // pending
  return (
    <Circle
      size={20}
      strokeWidth={1.5}
      style={{ color: 'var(--color-ks-text-disabled)' }}
    />
  );
}

function getLineColor(status: PhaseStatus['status'], nextStatus?: PhaseStatus['status']): string {
  if (status === 'done') return 'var(--color-ks-success)';
  if (status === 'active') return 'var(--color-ks-primary)';
  if (nextStatus === 'done' || nextStatus === 'active') return 'var(--color-ks-primary)';
  return 'var(--color-ks-border)';
}

function getTextColor(status: PhaseStatus['status']): string {
  if (status === 'done') return 'var(--color-ks-success-dark)';
  if (status === 'active') return 'var(--color-ks-primary)';
  return 'var(--color-ks-text-muted)';
}

export default function PhaseStepper({ phases }: PhaseStepperProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center justify-between min-w-0 gap-1 px-2">
        {phases.map((phase, idx) => {
          const isLast = idx === phases.length - 1;
          const nextPhase = phases[idx + 1];
          const lineColor = getLineColor(phase.status, nextPhase?.status);

          return (
            <div key={phase.name} className="flex items-center flex-1 last:flex-none">
              {/* Step */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <PhaseDot status={phase.status} />
                <span
                  className="text-xs font-[var(--font-family-ks-heading)] font-medium whitespace-nowrap"
                  style={{ color: getTextColor(phase.status) }}
                >
                  {phase.label}
                </span>
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div className="flex-1 mx-2 mt-[-18px]">
                  <div
                    className="h-[2px] w-full rounded-full transition-colors duration-300"
                    style={{ backgroundColor: lineColor }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

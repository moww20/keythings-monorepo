import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';

export interface WizardProgressStep<T extends string = string> {
  id: T;
  title: string;
  description?: string;
  icon?: ReactNode;
}

export interface WizardProgressProps<T extends string = string> {
  steps: WizardProgressStep<T>[];
  currentStep: T;
  completedSteps?: T[];
  className?: string;
}

function isStepCompleted<T extends string>(stepId: T, completedSteps: T[]): boolean {
  return completedSteps.includes(stepId);
}

export function WizardProgress<T extends string = string>({
  steps,
  currentStep,
  completedSteps = [],
  className = '',
}: WizardProgressProps<T>): React.JSX.Element {
  const gridStyle = {
    gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
  } as const;

  return (
    <div className={`grid gap-2 ${className}`.trim()} style={gridStyle}>
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isComplete = !isActive && isStepCompleted(step.id, completedSteps);

        return (
          <div
            key={step.id}
            className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-2 text-center transition-colors ${
              isActive
                ? 'border-accent/60 bg-accent/10 text-foreground'
                : isComplete
                  ? 'border-hairline bg-surface text-foreground'
                  : 'border-hairline bg-surface text-muted'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                isActive || isComplete ? 'bg-accent text-white' : 'bg-surface-strong text-muted'
              }`}
            >
              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </div>
            {step.title?.trim() ? (
              <span className="text-[11px] font-medium leading-tight">{step.title}</span>
            ) : null}
            {step.description?.trim() ? (
              <span className="text-[10px] text-muted">{step.description}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default WizardProgress;

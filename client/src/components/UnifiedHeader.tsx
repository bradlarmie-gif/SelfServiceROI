import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import abridgeLogo from '@assets/abridge-logo-wordmark-red_1769020684647.png';

interface ProgressDotsProps {
  currentStep: number;
  totalSteps: number;
  onStepClick?: (step: number) => void;
  stepLabels?: string[];
}

function ProgressDots({ currentStep, totalSteps, onStepClick, stepLabels }: ProgressDotsProps) {
  return (
    <div className="flex gap-1.5 sm:gap-2 items-center">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isClickable = onStepClick && stepNum < currentStep;
        const label = stepLabels?.[i];
        return isClickable ? (
          <button
            key={i}
            onClick={() => onStepClick(stepNum)}
            title={label || `Step ${stepNum}`}
            className={`h-1.5 sm:h-2 min-h-0 min-w-0 rounded-full transition-all cursor-pointer hover:opacity-60 ${
              'w-1.5 sm:w-2 bg-[#4A3F35]'
            }`}
            data-testid={`progress-dot-${stepNum}`}
          />
        ) : (
          <span
            key={i}
            title={label}
            className={`h-1.5 sm:h-2 rounded-full transition-all ${
              i === currentStep - 1
                ? 'w-4 sm:w-6 bg-[#EA2C00]'
                : i < currentStep
                  ? 'w-1.5 sm:w-2 bg-[#4A3F35]'
                  : 'w-1.5 sm:w-2 bg-[#E8E2DA]'
            }`}
            data-testid={`progress-dot-${stepNum}`}
          />
        );
      })}
    </div>
  );
}

export type PathType = "explore" | "switch" | "expand" | "measure" | "forecast" | "attain";

interface UnifiedHeaderProps {
  pathType: PathType;
  /** Overrides the section label derived from pathType (e.g. "Strategy" /
   * "Planning" when the Attain engine is mounted under the Value Attainment Hub). */
  pathLabel?: string;
  // Optional: landings (the hub, Metric Library) use this header with no steps.
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
  onBack?: () => void;
  showBack?: boolean;
  onHome?: () => void;
  onStepClick?: (step: number) => void;
  stepLabels?: string[];
  rightAction?: React.ReactNode;
  /** Replaces the default breadcrumb/step center with custom content (e.g. the
   * Proforma chapter tabs), so a flow with a richer center can still use the one
   * shared shell (logo, back, right slot). */
  centerContent?: React.ReactNode;
}

const PATH_LABELS: Record<PathType, string> = {
  explore: "Explore",
  switch: "Assess",
  expand: "Expand",
  measure: "Measure",
  forecast: "Forecast",
  attain: "Attain",
};

export function UnifiedHeader({
  pathType,
  pathLabel: pathLabelOverride,
  currentStep,
  totalSteps,
  stepName,
  onBack,
  showBack = true,
  onHome,
  onStepClick,
  stepLabels,
  rightAction,
  centerContent,
}: UnifiedHeaderProps) {
  const [, setLocation] = useLocation();
  
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onHome) {
      onHome();
    } else if (onBack) {
      onBack();
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const pathLabel = pathLabelOverride ?? PATH_LABELS[pathType];
  const hasSteps = currentStep != null && totalSteps != null;

  return (
    <header className="fixed top-0 left-0 right-0 bg-[#FDFCFA] border-b border-[#E8E2DA] z-50 h-14 sm:h-16 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 md:px-12 h-full grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* Left: Logo + Back */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 justify-self-start">
          <a 
            href="#" 
            onClick={handleLogoClick}
            className="flex items-center transition-opacity hover:opacity-70 cursor-pointer flex-shrink-0"
            data-testid="link-logo-home"
          >
            <img 
              src={abridgeLogo} 
              alt="Abridge" 
              className="h-5 sm:h-6"
            />
          </a>
          
          {showBack && (
            <>
              <div className="w-px h-5 bg-[#E8E2DA] hidden sm:block" />
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-[#8C8073] hover:text-[#1A1A1A] transition-colors p-1.5 -ml-1 rounded-md hover:bg-[#F5F0E8]"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm font-medium hidden sm:inline">Back</span>
              </button>
            </>
          )}
        </div>

        {/* Center: custom content, or the default Path + Step breadcrumb.
            Lives in the middle (auto) grid column so it stays pinned to the
            true page center regardless of the left/right widths. */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 justify-center overflow-hidden">
          {centerContent ?? (<>
          {pathLabel && (
            <span className={`text-xs sm:text-sm truncate min-w-0 ${stepName || hasSteps ? "text-[#A69A88] font-medium" : "text-[#1A1A1A] font-semibold"}`}>{pathLabel}</span>
          )}
          {pathLabel && (stepName || hasSteps) && <span className="text-[#D8CFC2] flex-shrink-0 hidden min-[480px]:inline">·</span>}
          {stepName ? (
            <span className="text-xs sm:text-sm text-[#1A1A1A] font-semibold truncate hidden min-[480px]:inline">{stepName}</span>
          ) : hasSteps ? (
            <span className="text-xs sm:text-sm text-[#8C8073] flex-shrink-0 hidden min-[480px]:inline">
              Step {currentStep} of {totalSteps}
            </span>
          ) : null}
          </>)}
        </div>

        {/* Right: optional action + Progress indicator */}
        <div className="flex items-center min-w-0 gap-2 sm:gap-3 justify-self-end">
          {rightAction}
          {hasSteps && (
            <>
              {/* Narrow phones (<480px): compact step counter only */}
              <span className="text-xs text-[#A69A88] font-medium tabular-nums min-[480px]:hidden" data-testid="step-counter-compact">
                {currentStep} / {totalSteps}
              </span>
              {/* Wider phones & up (≥480px): progress dots */}
              <div className="hidden min-[480px]:flex">
                <ProgressDots currentStep={currentStep!} totalSteps={totalSteps!} onStepClick={onStepClick} stepLabels={stepLabels} />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function UnifiedHeaderSpacer() {
  return <div className="h-14 sm:h-16" />;
}

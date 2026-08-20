import { ArrowRight } from "lucide-react";
import brandSymbol from "@assets/abridge-logo-symbol_1774906992195.png";

interface SplashScreenProps {
  onEnter: () => void;
}

/**
 * The landing screen.
 *
 * A split: the pitch and the single action on the left, a quiet tan brand
 * panel on the right. There is one button and it goes straight into the care
 * setting picker, because there is nothing else in this app to choose between.
 *
 * The right panel is the mark alone: no numbers, no caption. Every figure in
 * this tool is one the practice typed in themselves, so a specimen number on
 * the landing screen would be the one exception, and would read as a claim
 * rather than a calculation.
 */
export default function SplashScreen({ onEnter }: SplashScreenProps) {
  return (
    <div className="min-h-screen bg-[#FDFCFA] text-[#5E534A] antialiased">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left: the pitch and the one action */}
        <div className="flex items-center px-7 sm:px-14 lg:px-20 py-16 lg:py-0">
          <div className="w-full max-w-[540px]">
            <div className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-[#A69A88]">
              Abridge ROI
            </div>

            {/* no hard breaks: a forced wrap that reads well at 52px orphans a
                word on a phone. Let the measure do the wrapping. */}
            <h1 className="font-abridge text-[34px] sm:text-[44px] lg:text-[52px] leading-[1.08] text-[#3F352C] mt-6">
              What could Abridge be worth to your practice?
            </h1>

            <p className="mt-7 text-[16.5px] sm:text-[17px] leading-[1.6] text-[#8C8073] max-w-[440px]">
              Answer a few questions about how your practice actually runs.
              You will get an annual figure you can defend, built only from
              numbers you entered yourself.
            </p>

            <button
              onClick={onEnter}
              data-testid="button-enter-app"
              className="group mt-11 inline-flex items-center gap-3 rounded-full bg-[#EA2C00] px-8 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#D12800] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA2C00] focus-visible:ring-offset-2"
            >
              Estimate my value
              <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Right: the tan brand panel */}
        <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-[#F2EBE1] border-l border-[#E8E2DA]">
          <img
            src={brandSymbol}
            alt=""
            aria-hidden="true"
            className="w-[52%] max-w-[420px] select-none pointer-events-none"
            style={{ opacity: 0.22 }}
          />
        </div>
      </div>
    </div>
  );
}

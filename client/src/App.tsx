import { useState, useCallback, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

import { queryClient } from "./lib/queryClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionSecurityProvider } from "@/contexts/SessionSecurityContext";
import { PageTransition } from "@/components/PageTransition";

import SplashScreen from "@/pages/SplashScreen";
import QuickRoiCalculator from "@/pages/forecast/QuickRoiCalculator";
import QuickRoiEditorialPdfRoute from "@/components/forecast/QuickRoiEditorialPdfRoute";

/**
 * Self Service ROI Tool.
 *
 * One path, end to end: the landing screen hands straight off to the ROI
 * Calculator, which walks care setting → the partner's numbers → the answer,
 * and exports the editorial PDF. There is deliberately no hub and no other
 * tool to choose between — the whole application is this single flow.
 */

function usePreventNumberInputScroll() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        target.blur();
        e.preventDefault();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);
}

type AppView = "splash" | "calculator";

function App() {
  usePreventNumberInputScroll();

  // Print route for the editorial ROI Calculator PDF (?quickroipdf=1). Renders
  // the HTML-print document from the snapshot the calculator stashes in
  // localStorage, in the tab the export opens.
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("quickroipdf") === "1") {
    return <QuickRoiEditorialPdfRoute />;
  }

  const [currentView, setCurrentView] = useState<AppView>("splash");

  const navigateTo = useCallback((view: AppView) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  }, []);

  // Inactivity timeout: drop any partner numbers on screen and return to the
  // landing screen.
  const handleSessionClear = useCallback(() => {
    setCurrentView("splash");
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SessionSecurityProvider onSessionClear={handleSessionClear}>
          <TooltipProvider>
            <Toaster />

            <PageTransition pageKey={currentView}>
              {currentView === "splash" && (
                <SplashScreen onEnter={() => navigateTo("calculator")} />
              )}

              {currentView === "calculator" && (
                <QuickRoiCalculator
                  onBack={() => navigateTo("splash")}
                  onHome={() => navigateTo("splash")}
                />
              )}
            </PageTransition>
          </TooltipProvider>
        </SessionSecurityProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

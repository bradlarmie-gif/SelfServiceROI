import { useEffect } from "react";
import { QuickRoiEditorialPdfDocument, SAMPLE_QUICK_ROI_PDF_DATA, QUICK_ROI_PDF_STORAGE_KEY, type QuickRoiPdfData } from "./QuickRoiEditorialPdf";

/**
 * Print route for the editorial ROI Calculator PDF (?quickroipdf=1). Reads the
 * snapshot the answer screen's Export button stashed in localStorage and renders
 * the HTML-print document; with &print=1 it auto-opens the Save-as-PDF dialog
 * once fonts are ready. Falls back to sample data so the route always renders.
 */
export default function QuickRoiEditorialPdfRoute() {
  let data: QuickRoiPdfData = SAMPLE_QUICK_ROI_PDF_DATA;
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(QUICK_ROI_PDF_STORAGE_KEY) : null;
    if (raw) data = JSON.parse(raw) as QuickRoiPdfData;
  } catch {
    // fall back to sample
  }

  const autoPrint =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("print") === "1";

  useEffect(() => {
    if (!autoPrint) return;
    const fire = () => {
      try {
        window.print();
      } catch {
        // ignore
      }
    };
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    const t = setTimeout(() => {
      if (fonts?.ready) fonts.ready.then(fire, fire);
      else fire();
    }, 500);
    return () => clearTimeout(t);
  }, [autoPrint]);

  return (
    <div style={{ background: "#e9e5df", minHeight: "100vh", padding: "0" }}>
      {/*
        Chrome drops background colours when it prints, so every filled shape in
        this document (the composition bar, the swatches, the tinted panels)
        came out blank in the saved PDF while the coloured TEXT still printed.
        That is why the bar read as three grey numbers floating in white space.
        print-color-adjust: exact tells the print engine to honour the fills.
      */}
      <style>{`
        @media print {
          html, body, #root, * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      <QuickRoiEditorialPdfDocument data={data} />
    </div>
  );
}

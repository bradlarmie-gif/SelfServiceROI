import { Buffer } from 'buffer';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Polyfill Buffer for jsPDF in browser environment
window.Buffer = Buffer;

createRoot(document.getElementById("root")!).render(<App />);

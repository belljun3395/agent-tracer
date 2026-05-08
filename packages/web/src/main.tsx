import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/styles/index.css";
import App from "./App.js";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root missing from index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import "./styles.css";
import { registerDefaultRuntimeAdapters } from "../types/runtime-capabilities.defaults.js";

registerDefaultRuntimeAdapters();
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>);

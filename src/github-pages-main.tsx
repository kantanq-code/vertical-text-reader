import React from "react";
import { createRoot } from "react-dom/client";

import { Index } from "./routes/index";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element for GitHub Pages build.");
}

createRoot(root).render(
  <React.StrictMode>
    <Index />
  </React.StrictMode>,
);
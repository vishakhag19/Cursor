import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { styles as typescaleStyles } from "@material/web/typography/md-typescale-styles.js";
import "./material/register.js";
import "./theme.css";
import App from "./App.jsx";
import "./App.css";

if (typescaleStyles?.styleSheet) {
  document.adoptedStyleSheets.push(typescaleStyles.styleSheet);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

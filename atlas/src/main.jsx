import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { styles as typescaleStyles } from "@material/web/typography/md-typescale-styles.js";
/* Must run before Material / app UI mounts so shadow roots get the sheet. */
import "./hideScrollbars.js";
import "./material/register.js";
import "./theme.css";
import "./index.css";
import App from "./App.jsx";
import "./App.css";

if (typescaleStyles?.styleSheet) {
  document.adoptedStyleSheets = [
    ...document.adoptedStyleSheets,
    typescaleStyles.styleSheet,
  ];
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

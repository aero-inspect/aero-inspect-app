import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import { App } from "./App";
import "./styles/index.css";
import "./styles/layouts/first-pass.css";
import "./styles/pages/assets-workspace.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


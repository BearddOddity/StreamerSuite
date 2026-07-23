import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import PopoutShell from "./shell/PopoutShell";
import "@/index.css";
import "./apps";

const popoutAppId = new URLSearchParams(window.location.search).get("popout");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {popoutAppId ? <PopoutShell appId={popoutAppId} /> : <App />}
  </StrictMode>
);

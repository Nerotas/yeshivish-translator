import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { PronunciationProvider } from "./PronunciationProvider";

const rootElement = document.getElementById("root");
const queryClient = new QueryClient();

if (!rootElement) {
  throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <HashRouter>
      <QueryClientProvider client={queryClient}>
        <PronunciationProvider>
          <App />
        </PronunciationProvider>
      </QueryClientProvider>
    </HashRouter>
  </StrictMode>,
);

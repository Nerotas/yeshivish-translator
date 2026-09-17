import { StrictMode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import AppProviders from "./AppProviders";
import { readInitialPageData } from "./initial-page-data";

const rootElement = document.getElementById("root");
const queryClient = new QueryClient();
const initialPageData = readInitialPageData();

if (!rootElement) {
  throw new Error("Root element was not found.");
}

const application = (
  <StrictMode>
    <BrowserRouter>
      <AppProviders
        initialPageData={initialPageData}
        queryClient={queryClient}
      >
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>
);

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, application);
} else {
  createRoot(rootElement).render(application);
}

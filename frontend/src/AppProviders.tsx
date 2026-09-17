import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import InitialPageDataProvider from "./InitialPageDataProvider";
import type { InitialPageData } from "./models/initial-page-data";
import { PronunciationProvider } from "./PronunciationProvider";

interface AppProvidersProps {
  children: ReactNode;
  initialPageData: InitialPageData;
  queryClient: QueryClient;
}

/** Shared provider order for browser hydration and server rendering. */
export default function AppProviders({
  children,
  initialPageData,
  queryClient,
}: AppProvidersProps) {
  return (
    <InitialPageDataProvider value={initialPageData}>
      <QueryClientProvider client={queryClient}>
        <PronunciationProvider>{children}</PronunciationProvider>
      </QueryClientProvider>
    </InitialPageDataProvider>
  );
}
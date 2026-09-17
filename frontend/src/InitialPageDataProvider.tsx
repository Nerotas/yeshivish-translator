import type { ReactNode } from "react";
import { InitialPageDataContext } from "./initial-page-data";
import type { InitialPageData } from "./models/initial-page-data";

interface InitialPageDataProviderProps {
  children: ReactNode;
  value: InitialPageData;
}

export default function InitialPageDataProvider({
  children,
  value,
}: InitialPageDataProviderProps) {
  return (
    <InitialPageDataContext.Provider value={value}>
      {children}
    </InitialPageDataContext.Provider>
  );
}
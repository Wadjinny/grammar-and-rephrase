import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";

export type WorkspaceTab = "check" | "rephrase";

type WorkspaceTabContextValue = {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
};

const WorkspaceTabContext = createContext<WorkspaceTabContextValue | null>(
  null
);

function isWorkspaceTab(value: string | null): value is WorkspaceTab {
  return value === "check" || value === "rephrase";
}

export function WorkspaceTabProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Seed the mode from the URL so a shared link opens on the right tab.
  const [activeTab, setActiveTabState] = useState<WorkspaceTab>(() =>
    isWorkspaceTab(searchParams.get("mode")) ? (searchParams.get("mode") as WorkspaceTab) : "check"
  );

  const setActiveTab = useCallback(
    (tab: WorkspaceTab) => {
      setActiveTabState(tab);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("mode", tab);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const value = useMemo(
    () => ({ activeTab, setActiveTab }),
    [activeTab, setActiveTab]
  );

  return (
    <WorkspaceTabContext.Provider value={value}>
      {children}
    </WorkspaceTabContext.Provider>
  );
}

export function useWorkspaceTab() {
  const ctx = useContext(WorkspaceTabContext);
  if (!ctx) {
    throw new Error("useWorkspaceTab must be used within WorkspaceTabProvider");
  }
  return ctx;
}

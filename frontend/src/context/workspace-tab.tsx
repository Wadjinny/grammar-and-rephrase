import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type WorkspaceTab = "check" | "rephrase";

type WorkspaceTabContextValue = {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
};

const WorkspaceTabContext = createContext<WorkspaceTabContextValue | null>(
  null
);

export function WorkspaceTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("check");

  const value = useMemo(
    () => ({ activeTab, setActiveTab }),
    [activeTab]
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

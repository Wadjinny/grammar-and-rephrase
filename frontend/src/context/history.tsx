import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SavedItem } from "../types";

const STORAGE_KEY = "gemini_linguistic_history";
const MAX_ITEMS = 20;

type HistoryContextValue = {
  items: SavedItem[];
  addItem: (item: SavedItem) => void;
  deleteItem: (id: string) => void;
  clearAll: () => void;
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

function readStoredHistory(): SavedItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as SavedItem[];
  } catch (e) {
    console.warn("Could not read localstorage history", e);
    return [];
  }
}

function writeStoredHistory(items: SavedItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Could not write history to localStorage", e);
  }
}

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    setItems(readStoredHistory());
  }, []);

  const persist = useCallback((next: SavedItem[]) => {
    setItems(next);
    writeStoredHistory(next);
  }, []);

  const addItem = useCallback(
    (item: SavedItem) => {
      persist([item, ...items.slice(0, MAX_ITEMS - 1)]);
    },
    [items, persist]
  );

  const deleteItem = useCallback(
    (id: string) => {
      persist(items.filter((it) => it.id !== id));
    },
    [items, persist]
  );

  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  const value = useMemo(
    () => ({ items, addItem, deleteItem, clearAll }),
    [items, addItem, deleteItem, clearAll]
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error("useHistory must be used within HistoryProvider");
  }
  return ctx;
}

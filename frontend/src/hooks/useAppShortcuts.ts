import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useWorkspace } from "../context/workspace";
import { useWorkspaceTab } from "../context/workspace-tab";
import { isEditableTarget } from "../lib/shortcuts";

type UseAppShortcutsOptions = {
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
};

function focusEditorInput() {
  const el = document.getElementById(
    "input-text-area"
  ) as HTMLTextAreaElement | null;
  el?.focus();
}

export function useAppShortcuts({
  shortcutsOpen,
  setShortcutsOpen,
}: UseAppShortcutsOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTab, setActiveTab } = useWorkspaceTab();
  const { handleTrigger, loading } = useWorkspace();
  const onHistory = location.pathname === "/history";

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;
      const lower = key.toLowerCase();

      // Esc closes cheatsheet (also handled in the modal; keep as backup)
      if (key === "Escape" && shortcutsOpen) {
        e.preventDefault();
        setShortcutsOpen(false);
        return;
      }

      // ? — open shortcuts cheat sheet (ignore while typing)
      if (key === "?" && !mod && !e.altKey) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }

      if (!mod) return;

      // Ctrl/⌘ + K — focus input
      if (lower === "k" && !e.shiftKey) {
        e.preventDefault();
        if (onHistory) {
          navigate("/");
          requestAnimationFrame(() => {
            requestAnimationFrame(focusEditorInput);
          });
        } else {
          focusEditorInput();
        }
        return;
      }

      // Ctrl/⌘ + / — toggle checker / rephraser
      if (key === "/") {
        e.preventDefault();
        const next = activeTab === "check" ? "rephrase" : "check";
        setActiveTab(next);
        if (onHistory) navigate("/");
        return;
      }

      // Ctrl/⌘ + Enter — run check / rephrase
      if (key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (loading) return;
        if (onHistory) navigate("/");
        void handleTrigger();
        return;
      }

      // Ctrl/⌘ + Shift + H — go to History
      if (lower === "h" && e.shiftKey) {
        e.preventDefault();
        navigate("/history");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeTab,
    handleTrigger,
    loading,
    navigate,
    onHistory,
    setActiveTab,
    setShortcutsOpen,
    shortcutsOpen,
  ]);
}

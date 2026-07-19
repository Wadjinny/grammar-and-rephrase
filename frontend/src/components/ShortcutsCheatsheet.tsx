import { useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { APP_SHORTCUTS, shortcutKeys } from "../lib/shortcuts";

type ShortcutsCheatsheetProps = {
  open: boolean;
  onClose: () => void;
};

export default function ShortcutsCheatsheet({
  open,
  onClose,
}: ShortcutsCheatsheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            aria-label="Close shortcuts"
            className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md bg-white rounded-card shadow-hover p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-ctrl bg-indigo-50 flex items-center justify-center">
                  <Keyboard className="h-4.5 w-4.5 text-indigo-600" />
                </div>
                <div>
                  <h2
                    id="shortcuts-title"
                    className="text-[14px] font-bold text-gray-900"
                  >
                    Keyboard shortcuts
                  </h2>
                  <p className="text-[11px] text-gray-400 font-medium">
                    Press Esc to close
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-ctrl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="divide-y divide-gray-100">
              {APP_SHORTCUTS.map((shortcut) => (
                <li
                  key={shortcut.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <span className="text-[13px] text-gray-700 font-medium">
                    {shortcut.description}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {shortcutKeys(shortcut).map((key) => (
                      <kbd
                        key={key}
                        className="min-w-[26px] h-7 px-2 inline-flex items-center justify-center rounded-[10px] bg-gray-100 text-[11px] font-bold text-gray-700 tabular-nums"
                      >
                        {key}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

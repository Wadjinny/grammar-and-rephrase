export type ShortcutDef = {
  id: string;
  description: string;
  /** Keys shown for Windows / Linux */
  keys: string[];
  /** Keys shown for macOS (falls back to keys if omitted) */
  macKeys?: string[];
};

export const APP_SHORTCUTS: ShortcutDef[] = [
  {
    id: "focus",
    description: "Focus text input",
    keys: ["Ctrl", "K"],
    macKeys: ["⌘", "K"],
  },
  {
    id: "toggle-mode",
    description: "Toggle Grammar checker / Multi-rephraser",
    keys: ["Ctrl", "/"],
    macKeys: ["⌘", "/"],
  },
  {
    id: "run",
    description: "Run check or rephrase",
    keys: ["Ctrl", "Enter"],
    macKeys: ["⌘", "Enter"],
  },
  {
    id: "history",
    description: "Go to History",
    keys: ["Ctrl", "Shift", "H"],
    macKeys: ["⌘", "Shift", "H"],
  },
  {
    id: "help",
    description: "Show keyboard shortcuts",
    keys: ["?"],
  },
];

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function shortcutKeys(def: ShortcutDef): string[] {
  return isMacPlatform() && def.macKeys ? def.macKeys : def.keys;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

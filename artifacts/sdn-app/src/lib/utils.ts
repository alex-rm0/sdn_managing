import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Most users here are on Windows — only show the Mac-style ⌘ shortcut hint
// (and later, bind the Cmd key) to actual Mac users; everyone else gets Ctrl.
export function isMacPlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
}

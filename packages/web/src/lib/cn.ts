import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class strings with Tailwind-aware deduplication.
 *
 * Combines clsx (conditional class composition) with tailwind-merge
 * (canonical resolution of conflicting Tailwind utilities).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

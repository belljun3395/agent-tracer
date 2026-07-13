import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** class 문자열을 Tailwind를 인식하는 중복 제거와 함께 병합한다. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

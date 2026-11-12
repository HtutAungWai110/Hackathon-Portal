import { cn as mergeClasses } from 'cn';
import type { ClassValue } from 'cn';

/**
 * The class combinator the shadcn registry calls `cn(...)`. It merges
 * conflicting Tailwind utilities, so a caller can override a generated
 * component's width or padding without raising specificity.
 */
export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(...inputs);
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a URL-friendly slug from text. Handles German umlauts.
 */
export function slugify(text: string): string {
  let s = text.toLowerCase().trim()
  s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  s = s.replace(/[^a-z0-9]+/g, '-')
  s = s.replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
  return s
}

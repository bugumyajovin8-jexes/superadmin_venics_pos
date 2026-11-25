import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * users.phone holds the confirmed login number as "255712345678" (the POS
 * apps copy it from Supabase Auth). Shown the way people write it.
 */
export function formatTzPhone(phone?: string | null): string {
  const m = /^\+?255(\d{3})(\d{3})(\d{3})$/.exec(phone ?? "");
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : phone ?? "";
}

/** Digits without the 0 / 255 prefix, so 0712…, +255712… and 255712… compare equal. */
function localDigits(text: string): string {
  return text.replace(/\D/g, "").replace(/^(255|0)/, "");
}

/** Name or email contains the query, or (3+ digits typed) the phone number does. */
export function matchesUser(
  user: { name?: string | null; email?: string | null; phone?: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ([user.name, user.email].some(v => v?.toLowerCase().includes(q))) return true;
  const digits = localDigits(q);
  return digits.length >= 3 && !!user.phone && localDigits(user.phone).includes(digits);
}

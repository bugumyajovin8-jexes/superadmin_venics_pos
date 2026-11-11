import { cn, formatTzPhone } from "@/src/lib/utils"

/**
 * How a POS user signs in: their phone number, or — for accounts made before
 * phone sign-in that have not added a number yet — their email, flagged.
 */
export function UserContact({ phone, email, className }: { phone?: string | null; email?: string | null; className?: string }) {
  if (phone) {
    return <span className={cn("truncate", className)} title={email ?? undefined}>{formatTzPhone(phone)}</span>
  }
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1", className)}>
      <span className="min-w-0 truncate">{email || "No phone or email"}</span>
      {email && (
        <span
          className="shrink-0 rounded bg-amber-100 px-1 text-[9px] font-semibold uppercase leading-4 text-amber-800"
          title="Old email account: has not added a phone number yet"
        >
          Email only
        </span>
      )}
    </span>
  )
}

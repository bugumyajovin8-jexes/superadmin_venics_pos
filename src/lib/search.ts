import { createContext, useContext } from "react"

/**
 * The one search bar, in the header, for every page.
 *
 * "filter" pages narrow their own list as you type (the query is read with
 * usePageSearch()). On every other page the bar finds a shop by its name, its
 * owner, or the number calling, and opens that shop's health.
 */
export type SearchMode = "filter" | "find"

export const SEARCH: Record<string, { mode: SearchMode; placeholder: string }> = {
  dashboard: { mode: "find", placeholder: "Find a shop: name, owner or phone number" },
  shops: { mode: "filter", placeholder: "Search shops: name, owner, phone, email or ID" },
  licences: { mode: "filter", placeholder: "Search shops, owners, phone numbers or transaction codes" },
  "shop-health": { mode: "find", placeholder: "Find the shop: name, owner, or the phone number calling" },
  directory: { mode: "filter", placeholder: "Search shops and staff: name, phone, email or ID" },
  products: { mode: "filter", placeholder: "Search shops by name" },
  "delete-account": { mode: "filter", placeholder: "Search accounts: phone, name, email or shop" },
}
export const FIND_SHOP = { mode: "find" as SearchMode, placeholder: "Find a shop: name, owner or phone number" }

export const SearchContext = createContext<{ query: string; setQuery: (q: string) => void }>({ query: "", setQuery: () => {} })

/** What is typed in the header's search bar, for a page that filters its list by it. */
export function usePageSearch(): string {
  return useContext(SearchContext).query
}

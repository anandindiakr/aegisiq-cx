import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tenant branding.
 *
 * Signed-in surfaces read branding from the tenant-scoped `companies` row.
 * The public sign-in screen cannot read that table (RLS), so it calls the
 * `tenant_branding()` database function, which exposes only the four
 * presentation fields (name, logo, colour, tagline) and nothing else.
 */
export interface Branding {
  name: string;
  logo_url: string | null;
  brand_primary_color: string;
  brand_tagline: string | null;
}

export const DEFAULT_BRANDING: Branding = {
  name: "AegisIQ CX™",
  logo_url: null,
  brand_primary_color: "#4f8cff",
  brand_tagline: "CX Intelligence Platform",
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(value: string) {
  return HEX.test(value.trim());
}

/** Public (unauthenticated) branding for the sign-in screen. */
export const publicBrandingQuery = queryOptions({
  queryKey: ["public-branding"],
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<Branding> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("tenant_branding");
    if (error || !data || data.length === 0) return DEFAULT_BRANDING;
    const row = data[0] as Partial<Branding>;
    return {
      name: row.name || DEFAULT_BRANDING.name,
      logo_url: row.logo_url ?? null,
      brand_primary_color: isValidHex(row.brand_primary_color ?? "")
        ? (row.brand_primary_color as string)
        : DEFAULT_BRANDING.brand_primary_color,
      brand_tagline: row.brand_tagline ?? DEFAULT_BRANDING.brand_tagline,
    };
  },
});

/**
 * Paints the tenant's primary colour into the design-system tokens so every
 * shadcn component (buttons, focus rings, sidebar accents) follows it.
 */
export function applyBrandColor(color: string | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const value = color && isValidHex(color) ? color.trim() : null;
  const tokens = ["--primary", "--primary-glow", "--ring", "--sidebar-primary", "--sidebar-ring"];
  for (const token of tokens) {
    if (value) root.style.setProperty(token, value);
    else root.style.removeProperty(token);
  }
}

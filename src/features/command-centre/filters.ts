/**
 * Global filter model for the Executive Command Centre.
 *
 * Filters are serialisable so they can be reflected in the URL, persisted, and
 * handed straight to the `executive_overview` database function.
 */

export type DatePreset = "today" | "yesterday" | "7d" | "30d" | "custom";

export interface CommandFilters {
  preset: DatePreset;
  from: string; // ISO
  to: string; // ISO
  hourFrom: number;
  hourTo: number;
  regions: string[];
  outlets: string[];
  languages: string[];
  topics: string[];
  risks: string[];
  employees: string[];
  keywords: string[];
  alertTypes: string[];
}

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom" },
];

export const RISK_LEVELS = ["low", "medium", "high"] as const;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function presetRange(preset: DatePreset): { from: Date; to: Date } {
  const start = startOfToday();
  switch (preset) {
    case "yesterday":
      return { from: new Date(start.getTime() - 86_400_000), to: start };
    case "7d":
      return { from: new Date(start.getTime() - 6 * 86_400_000), to: new Date() };
    case "30d":
      return { from: new Date(start.getTime() - 29 * 86_400_000), to: new Date() };
    case "today":
    case "custom":
    default:
      return { from: start, to: new Date() };
  }
}

export function defaultFilters(): CommandFilters {
  const { from, to } = presetRange("today");
  return {
    preset: "today",
    from: from.toISOString(),
    to: to.toISOString(),
    hourFrom: 0,
    hourTo: 23,
    regions: [],
    outlets: [],
    languages: [],
    topics: [],
    risks: [],
    employees: [],
    keywords: [],
    alertTypes: [],
  };
}

export function withPreset(filters: CommandFilters, preset: DatePreset): CommandFilters {
  if (preset === "custom") return { ...filters, preset };
  const { from, to } = presetRange(preset);
  return { ...filters, preset, from: from.toISOString(), to: to.toISOString() };
}

export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function activeFilterCount(filters: CommandFilters): number {
  return (
    filters.regions.length +
    filters.outlets.length +
    filters.languages.length +
    filters.topics.length +
    filters.risks.length +
    filters.employees.length +
    filters.keywords.length +
    filters.alertTypes.length +
    (filters.hourFrom !== 0 || filters.hourTo !== 23 ? 1 : 0)
  );
}

/** Payload shape consumed by `public.executive_overview(jsonb)`. */
export function toRpcPayload(filters: CommandFilters): Record<string, unknown> {
  return {
    from: filters.from,
    to: filters.to,
    hourFrom: filters.hourFrom,
    hourTo: filters.hourTo,
    regions: filters.regions,
    outlets: filters.outlets,
    languages: filters.languages,
    topics: filters.topics,
    risks: filters.risks,
    employees: filters.employees,
    keywords: filters.keywords,
    alertTypes: filters.alertTypes,
  };
}

export function rangeLabel(filters: CommandFilters): string {
  const preset = DATE_PRESETS.find((p) => p.value === filters.preset);
  if (preset && filters.preset !== "custom") return preset.label;
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
  return `${fmt.format(new Date(filters.from))} – ${fmt.format(new Date(filters.to))}`;
}

/** Human-readable breakdown of a filter set, used by read-only share views. */
export function filterSummaryEntries(
  filters: CommandFilters,
): { label: string; value: string }[] {
  const list = (values: string[]) => (values.length === 0 ? "All" : values.join(", "));
  return [
    { label: "Date range", value: rangeLabel(filters) },
    {
      label: "Hours",
      value: `${String(filters.hourFrom).padStart(2, "0")}:00 – ${String(filters.hourTo).padStart(2, "0")}:59`,
    },
    { label: "Regions", value: list(filters.regions) },
    { label: "Outlets", value: filters.outlets.length === 0 ? "All" : `${filters.outlets.length} selected` },
    { label: "Languages", value: list(filters.languages) },
    { label: "Topics", value: list(filters.topics) },
    { label: "Risk levels", value: list(filters.risks) },
    { label: "Employees", value: list(filters.employees) },
    { label: "Keywords", value: list(filters.keywords) },
    { label: "Alert types", value: list(filters.alertTypes) },
  ];
}

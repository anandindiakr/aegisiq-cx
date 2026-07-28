import { useState } from "react";
import { CalendarClock, Check, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DATE_PRESETS,
  RISK_LEVELS,
  activeFilterCount,
  defaultFilters,
  toggleValue,
  withPreset,
  type CommandFilters,
  type DatePreset,
} from "@/features/command-centre/filters";
import type { ExecutiveFilterOptions } from "@/features/command-centre/types";
import { FilterPresets } from "./FilterPresets";

interface Option {
  value: string;
  label: string;
}

function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchable = false,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  searchable?: boolean;
}) {
  const [term, setTerm] = useState("");
  const visible = term
    ? options.filter((o) => o.label.toLowerCase().includes(term.toLowerCase()))
    : options;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-between gap-2 border-border bg-surface/60 text-xs font-medium",
            selected.length && "border-primary/50 text-primary",
          )}
        >
          {label}
          {selected.length > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] tabular-nums text-primary">
              {selected.length}
            </span>
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {searchable && (
          <div className="border-b border-border p-2">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="h-8 text-xs"
            />
          </div>
        )}
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {visible.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">No options</p>
            )}
            {visible.map((option) => {
              const active = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onToggle(option.value)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                >
                  <span className="truncate">{option.label}</span>
                  {active && <Check className="size-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </ScrollArea>
        {selected.length > 0 && (
          <div className="border-t border-border p-2">
            <Button variant="ghost" size="sm" className="h-7 w-full text-xs" onClick={onClear}>
              Clear {label.toLowerCase()}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function FilterBar({
  filters,
  options,
  onChange,
}: {
  filters: CommandFilters;
  options: ExecutiveFilterOptions;
  onChange: (next: CommandFilters) => void;
}) {
  const count = activeFilterCount(filters);

  const set = <K extends keyof CommandFilters>(key: K, value: CommandFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const multi = (key: keyof CommandFilters, list: string[]) => ({
    selected: list,
    onToggle: (value: string) => set(key, toggleValue(list, value) as CommandFilters[typeof key]),
    onClear: () => set(key, [] as unknown as CommandFilters[typeof key]),
  });

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground lg:inline-flex">
          <SlidersHorizontal className="size-3.5" />
          Filters
        </span>

        <Select
          value={filters.preset}
          onValueChange={(value) => onChange(withPreset(filters, value as DatePreset))}
        >
          <SelectTrigger className="h-9 w-[150px] border-border bg-surface/60 text-xs">
            <CalendarClock className="size-3.5 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filters.preset === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={filters.from.slice(0, 10)}
              onChange={(e) => set("from", new Date(`${e.target.value}T00:00:00`).toISOString())}
              className="h-9 w-[140px] text-xs"
              aria-label="From date"
            />
            <Input
              type="date"
              value={filters.to.slice(0, 10)}
              onChange={(e) => set("to", new Date(`${e.target.value}T23:59:59`).toISOString())}
              className="h-9 w-[140px] text-xs"
              aria-label="To date"
            />
          </div>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 border-border bg-surface/60 text-xs",
                (filters.hourFrom !== 0 || filters.hourTo !== 23) &&
                  "border-primary/50 text-primary",
              )}
            >
              Time {String(filters.hourFrom).padStart(2, "0")}:00–
              {String(filters.hourTo).padStart(2, "0")}:59
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 space-y-3 p-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                From hour
              </p>
              <Select
                value={String(filters.hourFrom)}
                onValueChange={(v) => set("hourFrom", Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)} className="text-xs">
                      {String(h).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                To hour
              </p>
              <Select
                value={String(filters.hourTo)}
                onValueChange={(v) => set("hourTo", Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)} className="text-xs">
                      {String(h).padStart(2, "0")}:59
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <MultiSelect
          label="Region"
          options={options.regions.map((r) => ({ value: r, label: r }))}
          {...multi("regions", filters.regions)}
        />
        <MultiSelect
          label="Outlet"
          searchable
          options={options.outlets.map((o) => ({ value: o.id, label: o.name }))}
          {...multi("outlets", filters.outlets)}
        />
        <MultiSelect
          label="Language"
          options={options.languages.map((l) => ({ value: l.code, label: l.name }))}
          {...multi("languages", filters.languages)}
        />
        <MultiSelect
          label="Type"
          options={options.topics.map((t) => ({ value: t, label: t }))}
          {...multi("topics", filters.topics)}
        />
        <MultiSelect
          label="Risk"
          options={RISK_LEVELS.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }))}
          {...multi("risks", filters.risks)}
        />
        <MultiSelect
          label="Employee"
          searchable
          options={options.employees.map((e) => ({ value: e, label: e }))}
          {...multi("employees", filters.employees)}
        />
        <MultiSelect
          label="Keyword"
          searchable
          options={options.keywords.map((k) => ({ value: k, label: k }))}
          {...multi("keywords", filters.keywords)}
        />
        <MultiSelect
          label="Alert type"
          options={options.alertTypes.map((a) => ({ value: a, label: a }))}
          {...multi("alertTypes", filters.alertTypes)}
        />

        <div className="ml-auto flex items-center gap-2">
          <FilterPresets filters={filters} onApply={onChange} />
          {count > 0 && (
            <Badge variant="outline" className="border-primary/40 text-[11px] text-primary">
              {count} active
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => onChange(defaultFilters())}
          >
            <RotateCcw className="size-3.5" />
            Reset filters
          </Button>
        </div>
      </div>
    </div>
  );
}

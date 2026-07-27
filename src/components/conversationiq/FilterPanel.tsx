import { RotateCcw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chip, IQ_LANGUAGES } from "@/components/conversationiq/Badges";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  type IqFilters,
} from "@/features/conversationiq/filters";
import type { Camera, Outlet } from "@/features/platform/queries";
import { formatDuration } from "@/lib/format";

interface Props {
  filters: IqFilters;
  onChange: (next: IqFilters) => void;
  outlets: Outlet[];
  cameras: Camera[];
  employees: string[];
  keywords: string[];
  tags: string[];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function FilterPanel({
  filters,
  onChange,
  outlets,
  cameras,
  employees,
  keywords,
  tags,
}: Props) {
  const set = <K extends keyof IqFilters>(key: K, value: IqFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const visibleCameras =
    filters.outletId === "all" ? cameras : cameras.filter((c) => c.outlet_id === filters.outletId);
  const count = activeFilterCount(filters);

  return (
    <aside className="panel h-fit w-full shrink-0 p-4 lg:sticky lg:top-4 lg:w-72">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-primary" /> Filters
        </span>
        {count > 0 && <Chip tone="info">{count} active</Chip>}
      </div>

      <div className="space-y-4">
        <Field label="Date range">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set("dateFrom", e.target.value)}
              className="bg-surface text-xs"
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set("dateTo", e.target.value)}
              className="bg-surface text-xs"
            />
          </div>
        </Field>

        <Field label="Outlet">
          <Select
            value={filters.outletId}
            onValueChange={(v) => onChange({ ...filters, outletId: v, cameraId: "all" })}
          >
            <SelectTrigger className="bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outlets</SelectItem>
              {outlets.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Camera">
          <Select value={filters.cameraId} onValueChange={(v) => set("cameraId", v)}>
            <SelectTrigger className="bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cameras</SelectItem>
              {visibleCameras.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Language">
          <Select value={filters.language} onValueChange={(v) => set("language", v)}>
            <SelectTrigger className="bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {Object.entries(IQ_LANGUAGES).map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Sentiment">
          <Select value={filters.sentiment} onValueChange={(v) => set("sentiment", v)}>
            <SelectTrigger className="bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any sentiment</SelectItem>
              <SelectItem value="very_positive">Very positive</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
              <SelectItem value="very_negative">Very negative</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Risk">
          <Select value={filters.risk} onValueChange={(v) => set("risk", v)}>
            <SelectTrigger className="bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any risk</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Keyword">
          <Select value={filters.keyword} onValueChange={(v) => set("keyword", v)}>
            <SelectTrigger className="bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Any keyword</SelectItem>
              {keywords.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Review tag">
          <Select value={filters.tag} onValueChange={(v) => set("tag", v)}>
            <SelectTrigger className="bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Any tag</SelectItem>
              <SelectItem value="untagged">Not yet tagged</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Employee">
          <Select value={filters.employee} onValueChange={(v) => set("employee", v)}>
            <SelectTrigger className="bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={`Duration · ${formatDuration(filters.minDuration)} – ${formatDuration(filters.maxDuration)}`}
        >
          <Slider
            value={[filters.minDuration, filters.maxDuration]}
            min={0}
            max={3600}
            step={30}
            onValueChange={([min, max]) =>
              onChange({ ...filters, minDuration: min, maxDuration: max })
            }
            className="pt-2"
          />
        </Field>

        <Field label="Alert status">
          <Select value={filters.alertStatus} onValueChange={(v) => set("alertStatus", v)}>
            <SelectTrigger className="bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="none">No alert raised</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="space-y-2.5 rounded-lg border border-border bg-surface/50 p-3">
          <label className="flex items-center gap-2.5 text-xs">
            <Checkbox
              checked={filters.complaintsOnly}
              onCheckedChange={(v) => set("complaintsOnly", v === true)}
            />
            Only conversations with complaints
          </label>
          <label className="flex items-center gap-2.5 text-xs">
            <Checkbox
              checked={filters.escalatedOnly}
              onCheckedChange={(v) => set("escalatedOnly", v === true)}
            />
            Only escalated cases
          </label>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange({ ...DEFAULT_FILTERS, search: filters.search })}
        >
          <RotateCcw className="mr-2 size-4" /> Reset filters
        </Button>
      </div>
    </aside>
  );
}

/**
 * Alert analytics exports.
 *
 * Produces a CSV workbook-style file and a print-ready PDF document (via the
 * browser's print dialog, matching the Command Centre export pipeline) that
 * carry the same figures the dashboard shows: MTTA/MTTR summaries, severity
 * mix and the per-outlet breach breakdown.
 */
import type { AlertAnalytics } from "./sla";
import { describeMinutes } from "./sla";

export type AlertExportFormat = "csv" | "pdf";

function minutes(value: number | null): string {
  return value === null ? "—" : describeMinutes(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export interface AlertExportMeta {
  windowDays: number;
  generatedAt?: Date;
}

interface Section {
  title: string;
  head: string[];
  rows: (string | number)[][];
}

/** The shared shape both formats render, so CSV and PDF never drift apart. */
export function buildAlertExportSections(
  analytics: AlertAnalytics,
  meta: AlertExportMeta,
): Section[] {
  return [
    {
      title: "Summary",
      head: ["Metric", "Value"],
      rows: [
        ["Reporting window", `Last ${meta.windowDays} days`],
        ["Alerts raised", analytics.total],
        ["Still open", analytics.open],
        ["SLA breaches", analytics.breached],
        ["Escalated to backups", analytics.escalated],
        ["MTTA (mean time to acknowledge)", minutes(analytics.mtta)],
        ["MTTR (mean time to resolve)", minutes(analytics.mttr)],
        [
          "Breach rate",
          analytics.total === 0
            ? "—"
            : `${((analytics.breached / analytics.total) * 100).toFixed(1)}%`,
        ],
      ],
    },
    {
      title: "Severity mix",
      head: ["Severity", "Alerts", "Share"],
      rows: analytics.bySeverity.map((row) => [
        row.label,
        row.value,
        analytics.total === 0 ? "—" : `${((row.value / analytics.total) * 100).toFixed(1)}%`,
      ]),
    },
    {
      title: "Status mix",
      head: ["Status", "Alerts"],
      rows: analytics.byStatus.map((row) => [row.label, row.value]),
    },
    {
      title: "Per-outlet breach breakdown",
      head: ["Outlet", "Alerts", "SLA breaches", "Breach rate", "MTTR"],
      rows: analytics.byOutlet.map((row) => [
        row.label,
        row.value,
        row.breached,
        row.value === 0 ? "—" : `${((row.breached / row.value) * 100).toFixed(1)}%`,
        minutes(row.mttr),
      ]),
    },
    {
      title: "Daily alert trend",
      head: ["Day", "Alerts", "Critical / high"],
      rows: analytics.trend.map((row) => [row.label, row.value, row.secondary]),
    },
  ];
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv(sections: Section[], stamp: string) {
  const lines: string[] = [];
  for (const section of sections) {
    lines.push(csvCell(section.title));
    lines.push(section.head.map(csvCell).join(","));
    for (const row of section.rows) lines.push(row.map(csvCell).join(","));
    lines.push("");
  }
  download(`alert-analytics-${stamp}.csv`, lines.join("\n"), "text/csv;charset=utf-8;");
}

function exportPdf(sections: Section[], meta: AlertExportMeta) {
  const generated = (meta.generatedAt ?? new Date()).toLocaleString("en-GB");
  const body = sections
    .map(
      (section) => `
      <h2>${escapeHtml(section.title)}</h2>
      <table>
        <thead><tr>${section.head
          .map((h, i) => `<th class="${i === 0 ? "" : "n"}">${escapeHtml(h)}</th>`)
          .join("")}</tr></thead>
        <tbody>${section.rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell, i) =>
                    `<td class="${i === 0 ? "" : "n"}">${escapeHtml(String(cell))}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")}</tbody>
      </table>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>AegisIQ CX — Alert Analytics</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;margin:32px;}
      h1{font-size:22px;margin:0 0 4px}
      h2{font-size:14px;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:#334155}
      .muted{color:#64748b;font-size:12px;margin:0 0 8px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f8fafc;font-weight:600}
      .n{text-align:right}
      @page{margin:16mm}
    </style></head>
    <body>
      <h1>AegisIQ CX — Alert Analytics &amp; SLA</h1>
      <p class="muted">Last ${meta.windowDays} days · generated ${escapeHtml(generated)}</p>
      ${body}
      <script>window.onload=()=>{window.print()}</script>
    </body></html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=1080,height=760");
  if (!win) throw new Error("Allow pop-ups to export the alert analytics PDF.");
  win.document.write(html);
  win.document.close();
}

export function exportAlertAnalytics(
  format: AlertExportFormat,
  analytics: AlertAnalytics,
  meta: AlertExportMeta,
) {
  const sections = buildAlertExportSections(analytics, meta);
  if (format === "csv") {
    exportCsv(sections, new Date().toISOString().slice(0, 10));
    return;
  }
  exportPdf(sections, meta);
}

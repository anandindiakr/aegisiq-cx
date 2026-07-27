/**
 * Executive export pipeline.
 *
 * Produces CSV, Excel-compatible XML spreadsheets, print-ready PDF documents
 * and a PowerPoint-style HTML deck entirely in the browser, so board packs can
 * be produced without a server round-trip or third-party service.
 */
import type { ExecutiveOverview } from "./types";
import { rangeLabel, type CommandFilters } from "./filters";
import { cxBand, cxScore, executiveBriefing, recommendations } from "./insights";

export type ExportFormat = "csv" | "excel" | "pdf" | "powerpoint";

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

interface Sheet {
  name: string;
  rows: (string | number)[][];
}

function buildSheets(overview: ExecutiveOverview, filters: CommandFilters): Sheet[] {
  const k = overview.kpis;
  return [
    {
      name: "Summary",
      rows: [
        ["Metric", "Value", "Previous"],
        ["Period", rangeLabel(filters), ""],
        ["Generated", new Date(overview.generatedAt).toLocaleString("en-GB"), ""],
        ["CX score", cxScore(overview), ""],
        ["Total conversations", k.total, k.total_prev],
        ["Positive conversations", k.positive, k.positive_prev],
        ["Negative conversations", k.negative, k.negative_prev],
        ["Average sentiment", k.avg_sentiment.toFixed(3), k.avg_sentiment_prev.toFixed(3)],
        ["Average duration (s)", Math.round(k.avg_duration), Math.round(k.avg_duration_prev)],
        ["Complaints", k.complaints, k.complaints_prev],
        ["Refund requests", k.refunds, k.refunds_prev],
        ["Warranty requests", k.warranty, k.warranty_prev],
        ["Manager escalations", k.escalations, k.escalations_prev],
        ["Alerts", k.alerts, ""],
        ["Active outlets", k.active_outlets, k.total_outlets],
        ["Online cameras", k.online_cameras, k.total_cameras],
      ],
    },
    {
      name: "Outlets",
      rows: [
        [
          "Outlet",
          "Code",
          "Region",
          "Conversations",
          "Avg sentiment",
          "Positive %",
          "Complaint %",
          "Escalations",
          "Score",
        ],
        ...overview.outlets.map((o) => [
          o.name,
          o.code,
          o.region ?? "",
          o.conversations,
          o.avg_sentiment.toFixed(3),
          o.positive_rate.toFixed(1),
          o.complaint_rate.toFixed(1),
          o.escalations,
          o.overall_score.toFixed(1),
        ]),
      ],
    },
    {
      name: "Regions",
      rows: [
        ["Region", "Conversations", "Positive", "Negative", "Avg sentiment", "Escalations"],
        ...overview.regions.map((r) => [
          r.region,
          r.conversations,
          r.positives,
          r.negatives,
          r.avg_sentiment.toFixed(3),
          r.escalations,
        ]),
      ],
    },
    {
      name: "Languages",
      rows: [
        ["Language", "Code", "Conversations", "Avg sentiment", "Previous period"],
        ...overview.languages.map((l) => [
          l.name,
          l.code,
          l.conversations,
          l.avg_sentiment.toFixed(3),
          l.prev_count,
        ]),
      ],
    },
    {
      name: "Keywords",
      rows: [
        ["Term", "Mentions", "Avg sentiment"],
        ...overview.keywords.map((k2) => [k2.term, k2.mentions, k2.avg_sentiment.toFixed(3)]),
      ],
    },
    {
      name: "Issues",
      rows: [
        ["Issue", "Occurrences", "Avg sentiment", "Previous period"],
        ...overview.issues.map((i) => [
          i.label,
          i.occurrences,
          i.avg_sentiment.toFixed(3),
          i.prev_count,
        ]),
      ],
    },
    {
      name: "Daily trend",
      rows: [
        ["Date", "Conversations", "Negative", "Avg sentiment"],
        ...overview.daily.map((d) => [
          d.day,
          d.conversations,
          d.negatives,
          d.avg_sentiment.toFixed(3),
        ]),
      ],
    },
  ];
}

function exportCsv(overview: ExecutiveOverview, filters: CommandFilters, stamp: string) {
  const body = buildSheets(overview, filters)
    .map(
      (sheet) =>
        `# ${sheet.name}\n${sheet.rows.map((row) => row.map(csvCell).join(",")).join("\n")}`,
    )
    .join("\n\n");
  download(`aegisiq-executive-${stamp}.csv`, "text/csv", body);
}

/** SpreadsheetML keeps multi-sheet fidelity and opens natively in Excel. */
function exportExcel(overview: ExecutiveOverview, filters: CommandFilters, stamp: string) {
  const sheets = buildSheets(overview, filters)
    .map((sheet) => {
      const rows = sheet.rows
        .map(
          (row) =>
            `<Row>${row
              .map((cell) =>
                typeof cell === "number"
                  ? `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`
                  : `<Cell><Data ss:Type="String">${escapeHtml(String(cell))}</Data></Cell>`,
              )
              .join("")}</Row>`,
        )
        .join("");
      return `<Worksheet ss:Name="${escapeHtml(sheet.name)}"><Table>${rows}</Table></Worksheet>`;
    })
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets}</Workbook>`;
  download(`aegisiq-executive-${stamp}.xls`, "application/vnd.ms-excel", xml);
}

function documentShell(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Inter, system-ui, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin: 28px 0 10px; }
  p { font-size: 12.5px; line-height: 1.6; margin: 0 0 8px; }
  .muted { color: #64748b; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .kpi span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: #64748b; }
  .kpi strong { font-size: 18px; }
  .slide { page-break-after: always; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; margin-bottom: 20px; min-height: 420px; }
  @media print { body { padding: 0; } .slide { border: none; } }
</style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script></body></html>`;
}

function openPrintable(html: string) {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) throw new Error("Pop-up blocked. Allow pop-ups to generate the document.");
  win.document.write(html);
  win.document.close();
}

function kpiBlock(overview: ExecutiveOverview): string {
  const k = overview.kpis;
  const items: [string, string][] = [
    ["Conversations", k.total.toLocaleString("en-GB")],
    ["CX score", String(cxScore(overview))],
    ["Avg sentiment", k.avg_sentiment.toFixed(2)],
    ["Alerts", k.alerts.toLocaleString("en-GB")],
    ["Positive", k.positive.toLocaleString("en-GB")],
    ["Negative", k.negative.toLocaleString("en-GB")],
    ["Escalations", k.escalations.toLocaleString("en-GB")],
    ["Active outlets", `${k.active_outlets}/${k.total_outlets}`],
  ];
  return `<div class="kpis">${items
    .map(
      ([label, value]) => `<div class="kpi"><span>${label}</span><strong>${value}</strong></div>`,
    )
    .join("")}</div>`;
}

function tableBlock(sheet: Sheet, limit = 20): string {
  const [head, ...rows] = sheet.rows;
  return `<table><thead><tr>${head
    .map((h, i) => `<th class="${i === 0 ? "" : "n"}">${escapeHtml(String(h))}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .slice(0, limit)
    .map(
      (row) =>
        `<tr>${row
          .map((c, i) => `<td class="${i === 0 ? "" : "n"}">${escapeHtml(String(c))}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table>`;
}

function exportPdf(overview: ExecutiveOverview, filters: CommandFilters) {
  const sheets = buildSheets(overview, filters);
  const score = cxScore(overview);
  const body = `
    <h1>AegisIQ CX — Executive Command Centre</h1>
    <p class="muted">${escapeHtml(rangeLabel(filters))} · generated ${new Date(overview.generatedAt).toLocaleString("en-GB")} · CX score ${score} (${cxBand(score).label})</p>
    <h2>Executive summary</h2>
    ${executiveBriefing(overview)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("")}
    <h2>Key indicators</h2>
    ${kpiBlock(overview)}
    <h2>Outlet performance</h2>
    ${tableBlock(sheets[1])}
    <h2>Regional comparison</h2>
    ${tableBlock(sheets[2])}
    <h2>Top issues</h2>
    ${tableBlock(sheets[5], 10)}
    <h2>Recommended actions</h2>
    ${recommendations(overview)
      .map(
        (r) =>
          `<p><strong>${escapeHtml(r.title)}</strong> — ${escapeHtml(r.detail)} <em class="muted">(${r.priority} priority · ${escapeHtml(r.owner)})</em></p>`,
      )
      .join("")}
  `;
  openPrintable(documentShell("AegisIQ CX Executive Report", body));
}

function exportDeck(overview: ExecutiveOverview, filters: CommandFilters) {
  const sheets = buildSheets(overview, filters);
  const score = cxScore(overview);
  const slides = [
    `<div class="slide"><h1>AegisIQ CX — Executive Briefing</h1><p class="muted">${escapeHtml(rangeLabel(filters))}</p><h2>Overall CX score</h2><p style="font-size:64px;font-weight:600;margin:0">${score}</p><p class="muted">${cxBand(score).label}</p></div>`,
    `<div class="slide"><h1>Key indicators</h1>${kpiBlock(overview)}</div>`,
    `<div class="slide"><h1>Executive summary</h1>${executiveBriefing(overview)
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join("")}</div>`,
    `<div class="slide"><h1>Outlet performance</h1>${tableBlock(sheets[1], 12)}</div>`,
    `<div class="slide"><h1>Regional comparison</h1>${tableBlock(sheets[2], 12)}</div>`,
    `<div class="slide"><h1>Top issues</h1>${tableBlock(sheets[5], 10)}</div>`,
    `<div class="slide"><h1>Recommended actions</h1>${recommendations(overview)
      .map((r) => `<p><strong>${escapeHtml(r.title)}</strong> — ${escapeHtml(r.detail)}</p>`)
      .join("")}</div>`,
  ].join("");
  openPrintable(documentShell("AegisIQ CX Executive Deck", slides));
}

export function exportExecutiveReport(
  format: ExportFormat,
  overview: ExecutiveOverview,
  filters: CommandFilters,
) {
  const stamp = new Date().toISOString().slice(0, 10);
  switch (format) {
    case "csv":
      return exportCsv(overview, filters, stamp);
    case "excel":
      return exportExcel(overview, filters, stamp);
    case "pdf":
      return exportPdf(overview, filters);
    case "powerpoint":
      return exportDeck(overview, filters);
  }
}

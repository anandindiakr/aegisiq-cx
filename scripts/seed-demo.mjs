#!/usr/bin/env node
/**
 * AegisIQ CX™ demo seed.
 *
 * Loads a deterministic, realistic demo tenant for local development and CI:
 *   1 company · 5 outlets · 32 cameras · 1,000 conversations (+ transcripts,
 *   summaries, alerts, languages and keyword library).
 *
 * Idempotent: it wipes and re-creates the demo company's rows only, so it can
 * be run repeatedly without duplicating data.
 *
 * Usage:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "[seed] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Set both before running the demo seed.",
  );
  process.exit(1);
}

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OUTLET_COUNT = 5;
const CAMERA_COUNT = 32;
const CONVERSATION_COUNT = 1000;

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (serviceKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${serviceKey}`) {
        headers.delete("Authorization");
      }
      headers.set("apikey", serviceKey);
      return fetch(input, { ...init, headers });
    },
  },
});

/* ---------------------------------------------------------------- helpers */

// Deterministic PRNG so every local/CI run produces identical demo data.
let seed = 0x9e3779b9;
function rand() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) % 1_000_000) / 1_000_000;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => Math.floor(min + rand() * (max - min + 1));
const uuid = (prefix, n) =>
  `${prefix}${String(n).padStart(4, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function wipe(table) {
  const { error } = await supabase.from(table).delete().eq("company_id", COMPANY_ID);
  if (error) throw new Error(`${table} cleanup failed: ${error.message}`);
}

async function insertAll(table, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
  console.log(`[seed] ${table}: ${rows.length} rows`);
}

/* ------------------------------------------------------------- reference */

const REGIONS = [
  { region: "Gulf", city: "Dubai", country: "United Arab Emirates", tz: "Asia/Dubai" },
  { region: "Gulf", city: "Abu Dhabi", country: "United Arab Emirates", tz: "Asia/Dubai" },
  { region: "Europe", city: "London", country: "United Kingdom", tz: "Europe/London" },
  { region: "Europe", city: "Paris", country: "France", tz: "Europe/Paris" },
  { region: "South Asia", city: "Mumbai", country: "India", tz: "Asia/Kolkata" },
];
const MANAGERS = [
  "Layla Haddad",
  "Omar Al Farsi",
  "Grace Whitfield",
  "Julien Moreau",
  "Priya Nair",
];
const LANGS = ["en", "ar", "fr", "es", "hi", "zh"];
const TOPICS = [
  "Checkout wait time",
  "Product availability",
  "Refund request",
  "Loyalty programme",
  "Staff attitude",
  "Pricing dispute",
  "Delivery delay",
  "Warranty claim",
  "Store cleanliness",
  "Payment failure",
];
const AGENTS = [
  "Noura Aziz",
  "Daniel Okoro",
  "Sofia Marin",
  "Yusuf Karim",
  "Emma Clarke",
  "Ravi Shankar",
  "Chen Wei",
  "Marta Silva",
];
const CUSTOMER_TYPES = ["new", "returning", "loyalty_member", "corporate"];
const SENTIMENTS = [
  ["very_negative", -0.95, -0.6],
  ["negative", -0.6, -0.2],
  ["neutral", -0.2, 0.2],
  ["positive", 0.2, 0.6],
  ["very_positive", 0.6, 0.95],
];

/* ------------------------------------------------------------------ main */

async function main() {
  console.log("[seed] Resetting demo tenant …");
  for (const table of [
    "alerts",
    "summaries",
    "transcripts",
    "conversations",
    "cameras",
    "outlets",
    "keywords",
    "languages",
    "audit_logs",
  ]) {
    await wipe(table);
  }

  const { error: companyError } = await supabase.from("companies").upsert({
    id: COMPANY_ID,
    name: "Meridian Retail Group",
    legal_name: "Meridian Retail Group Holdings PLC",
    industry: "retail",
    contact_email: "cx-ops@meridianretail.example",
    contact_phone: "+971 4 555 0110",
    address: "Level 24, Emaar Square, Downtown Dubai",
    subscription_plan: "enterprise",
    status: "active",
    timezone: "Asia/Dubai",
    preferred_languages: ["en", "ar", "fr", "hi"],
  });
  if (companyError) throw new Error(`companies upsert failed: ${companyError.message}`);
  console.log("[seed] companies: 1 row");

  // Languages + keyword detection library
  await insertAll(
    "languages",
    [
      ["en", "English", "English"],
      ["ar", "Arabic", "العربية"],
      ["fr", "French", "Français"],
      ["es", "Spanish", "Español"],
      ["hi", "Hindi", "हिन्दी"],
      ["zh", "Mandarin", "普通话"],
    ].map(([code, name, native_name]) => ({
      company_id: COMPANY_ID,
      code,
      name,
      native_name,
      is_active: true,
    })),
  );

  await insertAll(
    "keywords",
    [
      ["refund", "risk", 0.8],
      ["complaint", "risk", 0.9],
      ["manager", "escalation", 0.7],
      ["lawsuit", "risk", 1],
      ["thank you", "delight", 0.5],
      ["excellent", "delight", 0.6],
      ["broken", "quality", 0.7],
      ["waiting", "operations", 0.6],
      ["price", "commercial", 0.5],
      ["cancel", "churn", 0.85],
    ].map(([term, category, weight]) => ({
      company_id: COMPANY_ID,
      term,
      category,
      weight,
      is_active: true,
    })),
  );

  // Outlets
  const outlets = Array.from({ length: OUTLET_COUNT }, (_, i) => {
    const geo = REGIONS[i % REGIONS.length];
    return {
      id: uuid("2222", i + 1),
      company_id: COMPANY_ID,
      name: `Meridian ${geo.city} Flagship`,
      code: `MR-${geo.city.slice(0, 3).toUpperCase()}-${i + 1}`,
      address: `${between(10, 400)} ${geo.city} Retail Avenue`,
      city: geo.city,
      country: geo.country,
      region: geo.region,
      timezone: geo.tz,
      manager_name: MANAGERS[i % MANAGERS.length],
      manager_email: `${MANAGERS[i % MANAGERS.length].split(" ")[0].toLowerCase()}@meridianretail.example`,
      status: "active",
      opened_at: `20${between(15, 22)}-0${between(1, 9)}-1${between(0, 9)}`,
    };
  });
  await insertAll("outlets", outlets);

  // Cameras
  const cameras = Array.from({ length: CAMERA_COUNT }, (_, i) => {
    const outlet = outlets[i % outlets.length];
    const status = rand() > 0.88 ? pick(["offline", "degraded", "maintenance"]) : "online";
    return {
      id: uuid("3333", i + 1),
      company_id: COMPANY_ID,
      outlet_id: outlet.id,
      name: `CAM-${String(i + 1).padStart(3, "0")}`,
      rtsp_url: `rtsp://edge.meridianretail.example/${outlet.code.toLowerCase()}/cam-${i + 1}`,
      location: pick(["Checkout lane", "Entrance", "Service desk", "Fitting rooms", "Electronics"]),
      status,
      audio_enabled: rand() > 0.2,
      firmware: `v${between(2, 4)}.${between(0, 9)}.${between(0, 9)}`,
      last_seen_at: new Date(Date.now() - between(0, 5_000) * 60_000).toISOString(),
    };
  });
  await insertAll("cameras", cameras);

  // Conversations (+ transcripts, summaries, alerts)
  const conversations = [];
  const transcripts = [];
  const summaries = [];
  const alerts = [];

  for (let i = 0; i < CONVERSATION_COUNT; i++) {
    const camera = cameras[i % cameras.length];
    const startedAt = new Date(Date.now() - between(0, 90 * 24 * 60) * 60_000);
    const [label, lo, hi] = SENTIMENTS[between(0, SENTIMENTS.length - 1)];
    const score = Number((lo + rand() * (hi - lo)).toFixed(2));
    const topic = pick(TOPICS);
    const escalated = score < -0.5 && rand() > 0.4;
    const id = uuid("4444", i + 1);

    conversations.push({
      id,
      company_id: COMPANY_ID,
      outlet_id: camera.outlet_id,
      camera_id: camera.id,
      reference: `CX-${String(100000 + i)}`,
      started_at: startedAt.toISOString(),
      ended_at: new Date(startedAt.getTime() + between(45, 900) * 1000).toISOString(),
      duration_seconds: between(45, 900),
      language_code: pick(LANGS),
      sentiment_score: score,
      sentiment: label,
      topic,
      agent_name: pick(AGENTS),
      customer_type: pick(CUSTOMER_TYPES),
      escalated,
    });

    // Two-turn transcript sample per conversation keeps the payload realistic.
    transcripts.push(
      {
        company_id: COMPANY_ID,
        conversation_id: id,
        speaker: "customer",
        sequence: 1,
        content: `I'm here about ${topic.toLowerCase()} and it hasn't been resolved yet.`,
        start_ms: 0,
        end_ms: 4200,
        confidence: 0.9,
        language_code: "en",
      },
      {
        company_id: COMPANY_ID,
        conversation_id: id,
        speaker: "agent",
        sequence: 2,
        content: "I understand — let me check that for you right away and find a resolution.",
        start_ms: 4300,
        end_ms: 9100,
        confidence: 0.93,
        language_code: "en",
      },
    );

    summaries.push({
      company_id: COMPANY_ID,
      conversation_id: id,
      summary: `Customer raised ${topic.toLowerCase()} at ${camera.location?.toLowerCase()}. Agent acknowledged and ${escalated ? "escalated to the duty manager" : "resolved in line"}.`,
      key_points: [topic, escalated ? "Escalated" : "Resolved at first contact", `Sentiment ${label}`],
      intent: topic,
      resolution_status: escalated ? "escalated" : "resolved",
      model: "google/gemini-2.5-flash",
    });

    if (escalated) {
      alerts.push({
        company_id: COMPANY_ID,
        outlet_id: camera.outlet_id,
        conversation_id: id,
        title: `${topic} escalation at ${camera.name}`,
        description: `Negative sentiment (${score}) detected with escalation keywords.`,
        category: score < -0.8 ? "risk" : "service",
        severity: score < -0.85 ? "critical" : score < -0.7 ? "high" : "medium",
        status: pick(["open", "acknowledged", "resolved"]),
        triggered_at: startedAt.toISOString(),
      });
    }
  }

  await insertAll("conversations", conversations);
  await insertAll("transcripts", transcripts, 1000);
  await insertAll("summaries", summaries);
  await insertAll("alerts", alerts);

  await insertAll(
    "audit_logs",
    Array.from({ length: 40 }, (_, i) => ({
      company_id: COMPANY_ID,
      actor_name: pick(MANAGERS),
      action: pick(["update", "create", "acknowledge", "export", "sign_in"]),
      entity_type: pick(["outlet", "camera", "alert", "company", "profile"]),
      ip_address: `10.${between(0, 255)}.${between(0, 255)}.${between(1, 254)}`,
      metadata: { source: "demo-seed", index: i },
    })),
  );

  console.log("[seed] Demo tenant ready.");
}

main().catch((error) => {
  console.error(`[seed] Failed: ${error.message}`);
  process.exit(1);
});

ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS delivery jsonb NOT NULL DEFAULT '{"autoExport":false,"formats":[],"notifyOnComplete":true,"notifyOnFailure":true,"recipients":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS formatting jsonb NOT NULL DEFAULT '{"density":"comfortable","coverPage":true,"includeCharts":true}'::jsonb;

ALTER TABLE public.report_template_versions
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS formatting jsonb NOT NULL DEFAULT '{}'::jsonb;
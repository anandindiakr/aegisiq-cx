
DO $$
DECLARE
  cid uuid;
  base_outlets uuid[];
BEGIN
  SELECT company_id INTO cid FROM public.outlets LIMIT 1;

  -- Map coordinates for existing outlets
  UPDATE public.outlets SET latitude = 25.2048, longitude = 55.2708 WHERE code = 'MR-DUB-1';
  UPDATE public.outlets SET latitude = 24.4539, longitude = 54.3773 WHERE code = 'MR-ABU-2';
  UPDATE public.outlets SET latitude = 51.5072, longitude = -0.1276 WHERE code = 'MR-LON-3';
  UPDATE public.outlets SET latitude = 48.8566, longitude = 2.3522   WHERE code = 'MR-PAR-4';
  UPDATE public.outlets SET latitude = 19.0760, longitude = 72.8777  WHERE code = 'MR-MUM-5';

  INSERT INTO public.outlets (company_id, name, code, city, country, region, timezone, manager_name, manager_email, status, opened_at, latitude, longitude)
  VALUES
    (cid, 'Meridian Marina Bay',   'MR-SIN-6',  'Singapore', 'Singapore',   'APAC',       'Asia/Singapore', 'Adeline Tan',    'adeline.tan@example.com',   'active', '2021-03-14', 1.2834, 103.8607),
    (cid, 'Meridian Orchard',      'MR-SIN-7',  'Singapore', 'Singapore',   'APAC',       'Asia/Singapore', 'Marcus Lim',     'marcus.lim@example.com',    'active', '2020-09-01', 1.3048, 103.8318),
    (cid, 'Meridian Jewel Changi', 'MR-SIN-8',  'Singapore', 'Singapore',   'APAC',       'Asia/Singapore', 'Priya Raman',    'priya.raman@example.com',   'active', '2022-06-20', 1.3600, 103.9896),
    (cid, 'Meridian KLCC',         'MR-KUL-9',  'Kuala Lumpur', 'Malaysia', 'APAC',       'Asia/Kuala_Lumpur', 'Nurul Aziz',  'nurul.aziz@example.com',    'active', '2021-11-05', 3.1578, 101.7117),
    (cid, 'Meridian Manila Bay',   'MR-MNL-10', 'Manila', 'Philippines',    'APAC',       'Asia/Manila',    'Jose Delgado',   'jose.delgado@example.com',  'active', '2022-02-11', 14.5547, 120.9843),
    (cid, 'Meridian Doha West Bay','MR-DOH-11', 'Doha', 'Qatar',            'Gulf',       'Asia/Qatar',     'Hamad Al Suwaidi','hamad.als@example.com',    'active', '2023-01-19', 25.3213, 51.5310),
    (cid, 'Meridian Bengaluru',    'MR-BLR-12', 'Bengaluru', 'India',       'South Asia', 'Asia/Kolkata',   'Kavya Nair',     'kavya.nair@example.com',    'active', '2023-05-30', 12.9716, 77.5946)
  ON CONFLICT DO NOTHING;

  -- Cameras for the new outlets
  INSERT INTO public.cameras (company_id, outlet_id, name, location, status, audio_enabled, firmware, last_seen_at)
  SELECT cid, o.id,
         o.code || ' · CAM-' || g,
         (ARRAY['Front counter','Service desk','Returns bay'])[g],
         (CASE WHEN (abs(hashtextextended(o.code || g::text, 7)) % 100) < 84 THEN 'online'
               WHEN (abs(hashtextextended(o.code || g::text, 7)) % 100) < 92 THEN 'degraded'
               WHEN (abs(hashtextextended(o.code || g::text, 7)) % 100) < 97 THEN 'maintenance'
               ELSE 'offline' END)::camera_status,
         true,
         '4.2.' || (abs(hashtextextended(o.code || g::text, 3)) % 9),
         now() - ((abs(hashtextextended(o.code || g::text, 11)) % 90) || ' minutes')::interval
  FROM public.outlets o CROSS JOIN generate_series(1,3) g
  WHERE o.code IN ('MR-SIN-6','MR-SIN-7','MR-SIN-8','MR-KUL-9','MR-MNL-10','MR-DOH-11','MR-BLR-12');

  SELECT array_agg(id ORDER BY code) INTO base_outlets FROM public.outlets WHERE company_id = cid AND deleted_at IS NULL;

  -- 4,000 additional conversations (total 5,000)
  INSERT INTO public.conversations (
    company_id, outlet_id, camera_id, reference, started_at, ended_at, duration_seconds,
    language_code, sentiment_score, sentiment, topic, agent_name, customer_type, escalated,
    risk_level, status, emotion
  )
  SELECT
    cid,
    o.id,
    (SELECT c.id FROM public.cameras c WHERE c.outlet_id = o.id ORDER BY c.name LIMIT 1),
    'CX-' || to_char(now(), 'YY') || '-' || lpad((100000 + g)::text, 6, '0'),
    ts,
    ts + (dur || ' seconds')::interval,
    dur,
    lang,
    round(score, 2),
    (CASE WHEN score >= 0.55 THEN 'very_positive'
          WHEN score >= 0.18 THEN 'positive'
          WHEN score >= -0.15 THEN 'neutral'
          WHEN score >= -0.55 THEN 'negative'
          ELSE 'very_negative' END)::sentiment_label,
    topic,
    agent,
    (ARRAY['new','returning','member','vip'])[1 + (r3 % 4)],
    score < -0.55 OR (r4 % 100) < 4,
    (CASE WHEN score < -0.55 THEN 'high' WHEN score < -0.1 THEN 'medium' ELSE 'low' END)::risk_level,
    (CASE WHEN (r5 % 100) < 58 THEN 'closed'
          WHEN (r5 % 100) < 74 THEN 'resolved'
          WHEN (r5 % 100) < 86 THEN 'in_review'
          WHEN (r5 % 100) < 94 THEN 'new'
          ELSE 'escalated' END)::conversation_status,
    (CASE WHEN score >= 0.5 THEN 'happy'
          WHEN score >= 0.15 THEN 'satisfied'
          WHEN score >= -0.15 THEN 'neutral'
          WHEN score >= -0.45 THEN 'confused'
          WHEN score >= -0.7 THEN 'frustrated'
          ELSE 'angry' END)::emotion_label
  FROM (
    SELECT
      g,
      base_outlets[1 + (abs(hashtextextended('o' || g::text, 1)) % array_length(base_outlets,1))] AS outlet_id,
      date_trunc('day', now())
        - (CASE WHEN g <= 430 THEN 0 ELSE 1 + (abs(hashtextextended('d' || g::text, 2)) % 29) END || ' days')::interval
        + ((ARRAY[9,10,11,12,12,13,13,14,15,16,17,17,18,18,19,20])[1 + (abs(hashtextextended('h' || g::text, 4)) % 16)] || ' hours')::interval
        + ((abs(hashtextextended('m' || g::text, 5)) % 60) || ' minutes')::interval AS ts,
      120 + (abs(hashtextextended('u' || g::text, 6)) % 780) AS dur,
      (ARRAY['en','en','en','en','en','zh','zh','zh','ms','ms','ta','tl'])[1 + (abs(hashtextextended('l' || g::text, 8)) % 12)] AS lang,
      (ARRAY['Pricing','Refund','Warranty','Poor Service','Long Waiting Time','Product Availability','Promotion Confusion','Membership Issues'])[1 + (abs(hashtextextended('t' || g::text, 9)) % 8)] AS topic,
      (ARRAY['Aisha Rahman','Daniel Cheong','Farah Idris','Grace Wong','Imran Haque','Jasmine Ong','Kevin Tan','Leila Haddad','Miguel Santos','Nadia Karim','Omar Faruq','Rachel Lim'])[1 + (abs(hashtextextended('a' || g::text, 10)) % 12)] AS agent,
      ((abs(hashtextextended('s' || g::text, 12)) % 1000) / 1000.0) AS rnd,
      abs(hashtextextended('c' || g::text, 13)) AS r3,
      abs(hashtextextended('e' || g::text, 14)) AS r4,
      abs(hashtextextended('x' || g::text, 15)) AS r5
    FROM generate_series(1, 4000) g
  ) src
  JOIN public.outlets o ON o.id = src.outlet_id
  CROSS JOIN LATERAL (
    SELECT round((src.rnd * 1.7 - 0.75
      + CASE o.region WHEN 'APAC' THEN 0.10 WHEN 'Gulf' THEN 0.04 WHEN 'Europe' THEN 0.0 ELSE -0.06 END
      + CASE WHEN src.ts::date = current_date THEN 0.06 ELSE 0 END)::numeric, 2) AS score
  ) sc
  WHERE sc.score IS NOT NULL;
END $$;

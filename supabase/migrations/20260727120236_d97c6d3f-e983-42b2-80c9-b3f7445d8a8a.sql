
DO $$
DECLARE cid uuid; existing int; need int;
BEGIN
  SELECT company_id INTO cid FROM public.outlets LIMIT 1;
  SELECT count(*) INTO existing FROM public.alerts WHERE company_id = cid AND deleted_at IS NULL;
  need := GREATEST(0, 200 - existing);

  IF need > 0 THEN
    INSERT INTO public.alerts (company_id, outlet_id, conversation_id, title, description, category, severity, status, triggered_at)
    SELECT
      cid, c.outlet_id, c.id,
      cat || ' detected · ' || c.reference,
      'Automatically raised by AegisIQ CX signal engine for topic "' || coalesce(c.topic,'general') || '".',
      cat,
      (CASE WHEN c.sentiment_score < -0.65 THEN 'critical'
            WHEN c.sentiment_score < -0.35 THEN 'high'
            WHEN c.sentiment_score < -0.1 THEN 'medium'
            ELSE 'low' END)::alert_severity,
      (CASE WHEN (rn % 10) < 5 THEN 'open'
            WHEN (rn % 10) < 7 THEN 'acknowledged'
            WHEN (rn % 10) < 9 THEN 'resolved'
            ELSE 'dismissed' END)::alert_status,
      c.started_at + interval '3 minutes'
    FROM (
      SELECT c.*, row_number() OVER (ORDER BY c.sentiment_score ASC, c.started_at DESC) AS rn,
             (ARRAY['Complaint','Aggressive Voice','Negative Sentiment','Refund Escalation','Manager Called'])[1 + (abs(hashtextextended(c.id::text, 21)) % 5)] AS cat
      FROM public.conversations c
      WHERE c.company_id = cid AND c.deleted_at IS NULL AND c.sentiment_score < -0.2
      ORDER BY c.started_at DESC
      LIMIT 400
    ) c
    WHERE c.rn <= need;
  END IF;

  INSERT INTO public.conversation_keywords (company_id, conversation_id, keyword, category, confidence)
  SELECT cid, c.id,
    (ARRAY['Refund','Warranty','Discount','Promotion','Complaint','Manager','Receipt','Pricing','Membership','Delivery'])[1 + (abs(hashtextextended(c.id::text || k::text, 31)) % 10)],
    'auto',
    round((0.62 + (abs(hashtextextended(c.id::text || k::text, 33)) % 38) / 100.0)::numeric, 2)
  FROM public.conversations c
  CROSS JOIN generate_series(1,2) k
  WHERE c.company_id = cid AND c.deleted_at IS NULL
    AND c.started_at > now() - interval '31 days'
    AND NOT EXISTS (SELECT 1 FROM public.conversation_keywords ck WHERE ck.conversation_id = c.id)
  ON CONFLICT DO NOTHING;
END $$;

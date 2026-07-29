REVOKE SELECT ON public.device_credentials FROM authenticated;
GRANT SELECT (
  id, company_id, device_type, device_id, label, username, onvif_username,
  rtsp_url, notes, rotated_at, last_revealed_at, last_revealed_by, created_by,
  created_at, updated_at, rotation_interval_days, expires_at, rotation_status,
  rotation_requested_at, rotation_requested_by, rotation_note
) ON public.device_credentials TO authenticated;
GRANT ALL ON public.device_credentials TO service_role;
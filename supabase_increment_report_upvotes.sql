CREATE OR REPLACE FUNCTION public.increment_report_upvotes(p_report_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  updated_upvotes integer;
BEGIN
  UPDATE public.reports
  SET upvotes = COALESCE(upvotes, 0) + 1
  WHERE id::text = p_report_id
  RETURNING upvotes INTO updated_upvotes;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  RETURN updated_upvotes;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_report_upvotes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_report_upvotes(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_cards(_count integer, _admin uuid)
 RETURNS SETOF activation_cards
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  i integer; _code text; _row public.activation_cards%ROWTYPE;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR i IN 1.._count LOOP
    _code := 'YOMO-' || upper(
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4)
    );
    INSERT INTO public.activation_cards (code, created_by) VALUES (_code, _admin) RETURNING * INTO _row;
    RETURN NEXT _row;
  END LOOP;
END;
$function$;
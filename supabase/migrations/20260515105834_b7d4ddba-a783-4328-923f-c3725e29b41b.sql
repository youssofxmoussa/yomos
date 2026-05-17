CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('yomo-expire-cards') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='yomo-expire-cards');

SELECT cron.schedule(
  'yomo-expire-cards',
  '0 3 * * *',
  $$ SELECT public.expire_stale_cards(); $$
);
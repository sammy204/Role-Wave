-- Webhook lifecycle events need statuses that are distinct from failed
-- initialization and abandoned checkout attempts.

alter table public.rolewave_pro_payments
  drop constraint if exists rolewave_pro_payments_status_check;

alter table public.rolewave_pro_payments
  add constraint rolewave_pro_payments_status_check
  check (status in ('initialized', 'success', 'failed', 'abandoned', 'refunded', 'disputed'));

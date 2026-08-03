/*
# Restore legitimate onboarding updates

The admin-escalation hardening migration intentionally reduced profile UPDATE
privileges to full_name, but the existing onboarding flows also update
onboarding_completed and account_type on the user's own row.

Keep the privilege column-scoped: these are the only additional fields needed
by onboarding. is_admin remains excluded and is still protected by
prevent_self_admin_escalation().
*/

GRANT UPDATE (full_name, onboarding_completed, account_type)
ON public.profiles
TO authenticated;


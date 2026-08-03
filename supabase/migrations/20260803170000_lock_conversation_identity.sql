/* Prevent participants from reassigning conversations to another user/company. */

CREATE OR REPLACE FUNCTION public.protect_conversation_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role migrations/admin tooling may perform controlled repairs.
  IF auth.role() = 'service_role' OR public.is_admin_user() THEN
    RETURN NEW;
  END IF;

  -- Participants may update read timestamps, but never the ownership fields.
  NEW.id := OLD.id;
  NEW.company_id := OLD.company_id;
  NEW.candidate_profile_id := OLD.candidate_profile_id;
  NEW.source_job_id := OLD.source_job_id;
  NEW.created_at := OLD.created_at;
  NEW.last_message_at := OLD.last_message_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_conversation_identity ON public.conversations;
CREATE TRIGGER protect_conversation_identity
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.protect_conversation_identity();

REVOKE ALL ON FUNCTION public.protect_conversation_identity() FROM PUBLIC;

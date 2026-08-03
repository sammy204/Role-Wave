/* Add per-message delivery/read timestamps for chat status indicators. */

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_messages_delivered(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations conv
    WHERE conv.id = p_conversation_id
      AND (
        conv.candidate_profile_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.companies c
          WHERE c.id = conv.company_id AND c.owner_profile_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  UPDATE public.messages
  SET delivered_at = COALESCE(delivered_at, now())
  WHERE conversation_id = p_conversation_id
    AND sender_profile_id <> auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation public.conversations;
BEGIN
  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found' USING errcode = 'P0002';
  END IF;

  IF v_conversation.candidate_profile_id = auth.uid() THEN
    UPDATE public.conversations SET candidate_last_read_at = now() WHERE id = p_conversation_id;
  ELSIF EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = v_conversation.company_id AND c.owner_profile_id = auth.uid()
  ) THEN
    UPDATE public.conversations SET employer_last_read_at = now() WHERE id = p_conversation_id;
  ELSE
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  UPDATE public.messages
  SET delivered_at = COALESCE(delivered_at, now()),
      read_at = COALESCE(read_at, now())
  WHERE conversation_id = p_conversation_id
    AND sender_profile_id <> auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_delivered(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_delivered(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

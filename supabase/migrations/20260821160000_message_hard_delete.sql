-- Messages deleted by their sender disappear for both conversation participants.

drop policy if exists messages_participant_delete on public.messages;
create policy messages_participant_delete on public.messages
for delete using (
  sender_profile_id = auth.uid()
  and exists (
    select 1 from public.conversations conv
    where conv.id = messages.conversation_id
      and (
        conv.candidate_profile_id = auth.uid()
        or exists (
          select 1 from public.companies c
          where c.id = conv.company_id and c.owner_profile_id = auth.uid()
        )
      )
  )
);

notify pgrst, 'reload schema';

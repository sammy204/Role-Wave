import { supabase } from './supabase';

export async function sendMessagePush(input: {
  conversationId: string;
  messageId: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('send-message-push', {
    body: input,
  });

  if (error) throw error;
}

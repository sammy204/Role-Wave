import { supabase } from './supabase';

export async function sendTestPush(): Promise<{ sent: number; subscriptions: number }> {
  const { data, error } = await supabase.functions.invoke('send-test-push', {
    body: {
      title: 'RoleWave test notification',
      message: 'Push notifications are working.',
      url: '/candidate/dashboard',
    },
  });

  if (error) throw error;
  return data as { sent: number; subscriptions: number };
}

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

import { supabase } from './supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function touchPresence(online: boolean): Promise<void> {
  const { error } = await supabase.rpc('touch_presence', { p_online: online });
  if (error) throw error;
}


export function touchPresenceOnUnload(): void {
  void supabase.auth.getSession().then(({ data }) => {
    const accessToken = data.session?.access_token;
    if (!accessToken || !supabaseUrl || !supabaseKey) return;

    void fetch(`${supabaseUrl}/rest/v1/rpc/touch_presence`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ p_online: false }),
    }).catch(() => undefined);
  });
}
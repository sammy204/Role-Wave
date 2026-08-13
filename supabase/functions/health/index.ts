import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        status: "ok",
        service: "rolewave",
        database: "up",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "degraded",
        service: "rolewave",
        database: "down",
        error: String(err),
        timestamp: new Date().toISOString(),
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
});
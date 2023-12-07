import { createClient } from "@supabase/supabase-js";

export async function supabaseCreateClient(access_token, refresh_token) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  return supabase;
}

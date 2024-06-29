import { createClient } from "@supabase/supabase-js";

export async function supabaseCreateAuthClient(
  access_token,
  refresh_token,
  errorCallback
) {
  const supabase = supabaseCreateClient()

  if (access_token && refresh_token) {
    await supabase.auth
      .setSession({
        access_token,
        refresh_token,
      })
      .catch((error) => {
        if (errorCallback) {
          errorCallback(error.message);
        }
      });
  }

  return supabase;
}

export function supabaseCreateClient() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  return supabase;
}

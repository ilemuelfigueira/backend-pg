import { createClient } from "@supabase/supabase-js";

export async function supabaseCreateClient(
  access_token,
  refresh_token,
  errorCallback
) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

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

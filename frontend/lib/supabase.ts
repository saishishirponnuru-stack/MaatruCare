import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: "pkce",
        // The callback owns code/token exchange and surfaces errors. Avoid racing
        // automatic URL consumption against the application callback handler.
        detectSessionInUrl: false,
      },
    });
  }

  return browserClient;
}

// A stalled identity-provider lock must not leave the entire workspace loading forever.
export async function readSupabaseSession() {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      client.auth.getSession(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Your sign-in session could not be restored. Try again or sign out.")), 12000); }),
    ]);
    if (result.error) throw new Error("Your sign-in session could not be restored. Try signing in again.");
    return result.data.session;
  } finally { if (timer) clearTimeout(timer); }
}

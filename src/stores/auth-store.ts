import { create } from "zustand";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { openUrl } from "@tauri-apps/plugin-opener";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  setup_complete: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  initialize: () => void;
  signInWithDiscord: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,

  fetchProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      set({ profile: data });
    } else {
      set({ profile: null });
    }
  },

  initialize: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        set({ session, user: session.user });
        get().fetchProfile(session.user.id).then(() => set({ isLoading: false }));
      } else {
        set({ session: null, user: null, isLoading: false });
      }
    });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        set({ session, user: session.user });
        // Don't set isLoading to true on every event to avoid flickering,
        // but ensure we fetch the profile if the session changes
        await get().fetchProfile(session.user.id);
        set({ isLoading: false });
      } else {
        set({ session: null, user: null, profile: null, isLoading: false });
      }
    });

    // Listen for deep link callbacks from the system browser
    // e.g., vazorism://auth#access_token=...&refresh_token=...
    const processDeepLink = async (url: string) => {
      import("sonner").then(({ toast }) => toast.info("Deep link received: " + url));
      
      const urlObj = new URL(url);

      // 1. Check for Implicit flow (access_token in hash)
      if (url.includes("access_token=")) {
        import("sonner").then(({ toast }) => toast.info("Detected Implicit flow, parsing tokens..."));
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const hash = url.substring(hashIndex + 1);
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          
          if (access_token && refresh_token) {
            import("sonner").then(({ toast }) => toast.info("Setting implicit session..."));
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) {
              import("sonner").then(({ toast }) => toast.error("Session error: " + error.message));
            } else {
              import("sonner").then(({ toast }) => toast.success("Successfully logged in!"));
            }
          } else {
            import("sonner").then(({ toast }) => toast.error("Tokens missing in implicit deep link"));
          }
        }
      } 
      // 2. Check for PKCE flow (code in query params)
      else if (urlObj.searchParams.has("code")) {
        const code = urlObj.searchParams.get("code");
        import("sonner").then(({ toast }) => toast.info("Detected PKCE flow. Exchanging code..."));
        
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            import("sonner").then(({ toast }) => toast.error("PKCE exchange failed: " + error.message));
          } else {
            import("sonner").then(({ toast }) => toast.success("Successfully logged in via PKCE!"));
          }
        }
      } else {
         import("sonner").then(({ toast }) => toast.warning("Deep link recognized but no auth tokens found."));
      }
    };

    onOpenUrl(async (urls) => {
      import("sonner").then(({ toast }) => toast.info("onOpenUrl triggered with: " + urls.length + " urls"));
      for (const url of urls) {
        await processDeepLink(url);
      }
    }).catch(console.error);

    // Fallback: Tauri single instance manual emission (Removed from Rust, but keeping listener just in case)
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<string[]>("deep-link-received", async (event) => {
        import("sonner").then(({ toast }) => toast.info("deep-link-received event fired!"));
        for (const arg of event.payload) {
          if (arg.startsWith("vazorism://")) {
            await processDeepLink(arg);
          }
        }
      });
    }).catch(console.error);

    // Bulletproof Fallback: Poll Rust backend state every 1 second
    import("@tauri-apps/api/core").then(({ invoke }) => {
      setInterval(async () => {
        try {
          const url: string | null = await invoke("get_deep_link");
          if (url && url.startsWith("vazorism://")) {
            import("sonner").then(({ toast }) => toast.info("Deep link pulled from Rust polling fallback!"));
            await processDeepLink(url);
          }
        } catch (err) {
          // Ignore errors
        }
      }, 1000);
    }).catch(console.error);

    // Initial check for Android cold starts
    import("@tauri-apps/plugin-deep-link").then(async ({ getCurrent }) => {
      try {
        const payload: any = await getCurrent();
        
        let urlsToProcess: string[] = [];
        if (Array.isArray(payload)) {
           urlsToProcess = payload;
        } else if (payload && typeof payload === 'object' && typeof payload.url === 'string') {
           urlsToProcess = [payload.url];
        }

        if (urlsToProcess.length > 0) {
          import("sonner").then(({ toast }) => toast.info("Cold-start deep link received!"));
          for (const url of urlsToProcess) {
            await processDeepLink(url);
          }
        }
      } catch (e) {
        console.error("getCurrent error:", e);
      }
    }).catch(console.error);
  },

  signInWithDiscord: async () => {
    import("sonner").then(({ toast }) => toast.info("Initiating Discord OAuth..."));
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        skipBrowserRedirect: true,
        redirectTo: "vazorism://auth",
      },
    });
    
    if (error) {
        import("sonner").then(({ toast }) => toast.error("OAuth init failed: " + error.message));
    }

    if (data?.url) {
      import("sonner").then(({ toast }) => toast.info("Opening browser for Discord..."));
      await openUrl(data.url);
    }
  },

  signInWithGoogle: async () => {
    import("sonner").then(({ toast }) => toast.info("Initiating Google OAuth..."));
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
        redirectTo: "vazorism://auth",
      },
    });

    if (error) {
        import("sonner").then(({ toast }) => toast.error("OAuth init failed: " + error.message));
    }

    if (data?.url) {
      import("sonner").then(({ toast }) => toast.info("Opening browser for Google..."));
      await openUrl(data.url);
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));

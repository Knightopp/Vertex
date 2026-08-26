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

const LOCAL_USER_ID = "local_user";
const CACHED_PROFILE_KEY = "vazorism_cached_profile";
const LOCAL_PROFILE_KEY = "vazorism_local_profile";

// ---------------------------------------------------------------------------
// Offline-first: synchronously read the cached Supabase session from
// localStorage so the app renders immediately without waiting for the network.
// ---------------------------------------------------------------------------
function readCachedSession(): { session: Session | null; user: User | null } {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const session: Session = parsed;
          if (session?.access_token && session?.user) {
            return { session, user: session.user };
          }
        }
      }
    }
  } catch (_) {
    // Ignore parse errors — will fall back to full network init
  }
  return { session: null, user: null };
}

function readCachedProfile(userId?: string): Profile | null {
  try {
    if (userId && userId !== LOCAL_USER_ID) {
      const userSpecific = localStorage.getItem(`${CACHED_PROFILE_KEY}_${userId}`);
      if (userSpecific) return JSON.parse(userSpecific);
    }
    const generic = localStorage.getItem(CACHED_PROFILE_KEY);
    if (generic) return JSON.parse(generic);

    const localProf = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (localProf) return JSON.parse(localProf);
  } catch (_) {}
  return null;
}

function saveCachedProfile(profile: Profile) {
  try {
    localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));
    if (profile.id) {
      localStorage.setItem(`${CACHED_PROFILE_KEY}_${profile.id}`, JSON.stringify(profile));
    }
    if (profile.id === LOCAL_USER_ID) {
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
    }
  } catch (_) {}
}

function deriveDefaultProfile(user: User | null, customUsername?: string): Profile {
  const id = user?.id || LOCAL_USER_ID;
  const rawName =
    customUsername ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.custom_claims?.global_name ||
    user?.user_metadata?.preferred_username ||
    user?.user_metadata?.user_name ||
    user?.email?.split("@")[0] ||
    "Player";

  const cleanUsername = rawName.replace(/[^a-zA-Z0-9_.]/g, "").substring(0, 20) || "Player";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";

  return {
    id,
    username: cleanUsername,
    avatar_url: avatarUrl,
    setup_complete: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Pre-hydrate everything synchronously from localStorage on module load
const _cachedSession = readCachedSession();
let _cachedProfile = _cachedSession.user ? readCachedProfile(_cachedSession.user.id) : readCachedProfile();
const _hasLocalProfile = localStorage.getItem(LOCAL_PROFILE_KEY) !== null;

let _initialUser = _cachedSession.user;
let _isLocalMode = false;

if (_initialUser) {
  if (!_cachedProfile) {
    _cachedProfile = deriveDefaultProfile(_initialUser);
    saveCachedProfile(_cachedProfile);
  }
} else if (_hasLocalProfile && _cachedProfile) {
  _isLocalMode = true;
  _initialUser = {
    id: LOCAL_USER_ID,
    email: "local@vertex.app",
    user_metadata: { full_name: _cachedProfile.username },
    app_metadata: {},
    aud: "authenticated",
    created_at: _cachedProfile.created_at || new Date().toISOString(),
  } as unknown as User;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLocalMode: boolean;
  isLoading: boolean;
  initialize: () => void;
  signInWithDiscord: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  loginAsLocal: (customUsername?: string) => void;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: _cachedSession.session,
  user: _initialUser,
  profile: _cachedProfile,
  isLocalMode: _isLocalMode,
  isLoading: false, // 0ms delay: instant render from pre-hydrated state

  loginAsLocal: (customUsername?: string) => {
    const existing = readCachedProfile(LOCAL_USER_ID) || readCachedProfile();
    const username = (customUsername && customUsername.trim()) || existing?.username || "Player";
    const localProfile: Profile = {
      id: LOCAL_USER_ID,
      username,
      avatar_url: existing?.avatar_url || "",
      setup_complete: true,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveCachedProfile(localProfile);

    const fakeUser = {
      id: LOCAL_USER_ID,
      email: "local@vertex.app",
      user_metadata: { full_name: username },
      app_metadata: {},
      aud: "authenticated",
      created_at: localProfile.created_at,
    } as unknown as User;

    set({
      session: null,
      user: fakeUser,
      profile: localProfile,
      isLocalMode: true,
      isLoading: false,
    });
  },

  fetchProfile: async (userId: string) => {
    if (userId === LOCAL_USER_ID) {
      const local = readCachedProfile(LOCAL_USER_ID);
      if (local) set({ profile: local });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error && data) {
        const merged: Profile = {
          ...data,
          setup_complete: true, // auto-complete
        };
        set({ profile: merged });
        saveCachedProfile(merged);
      } else if (error) {
        // If table row not found or network error, ensure local cached profile remains
        const current = get().profile;
        if (!current) {
          const autoProfile = deriveDefaultProfile(get().user);
          set({ profile: autoProfile });
          saveCachedProfile(autoProfile);

          if (navigator.onLine) {
            supabase.from("profiles").upsert({
              id: userId,
              username: autoProfile.username,
              avatar_url: autoProfile.avatar_url,
              setup_complete: true,
              updated_at: new Date().toISOString(),
            }).then(null, () => {});
          }
        }
      }
    } catch (err) {
      console.warn("[AuthStore] fetchProfile offline fallback active:", err);
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const current = get().profile;
    const user = get().user;
    const id = current?.id || user?.id || LOCAL_USER_ID;

    const updated: Profile = {
      id,
      username: updates.username?.trim() || current?.username || "Player",
      avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : (current?.avatar_url || ""),
      setup_complete: true,
      created_at: current?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...updates,
    };

    set({ profile: updated });
    saveCachedProfile(updated);

    if (id !== LOCAL_USER_ID && navigator.onLine) {
      supabase.from("profiles").upsert({
        id,
        username: updated.username,
        avatar_url: updated.avatar_url,
        setup_complete: true,
        updated_at: updated.updated_at,
      }).then(null, (e: unknown) => console.warn("[AuthStore] Supabase profile sync failed:", e));
    }
  },

  initialize: () => {
    const state = get();
    if (state.user && state.user.id !== LOCAL_USER_ID) {
      state.fetchProfile(state.user.id).catch(() => {});
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const cached = readCachedProfile(session.user.id) || deriveDefaultProfile(session.user);
        saveCachedProfile(cached);
        set({ session, user: session.user, profile: cached, isLocalMode: false, isLoading: false });
        get().fetchProfile(session.user.id).catch(() => {});
      } else if (!get().isLocalMode) {
        const localProf = readCachedProfile(LOCAL_USER_ID);
        if (localProf) {
          get().loginAsLocal(localProf.username);
        } else {
          set({ session: null, user: null, profile: null, isLoading: false });
        }
      }
    }).catch(() => {
      // Offline: keep cached data intact with zero disruption
      set({ isLoading: false });
    });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const cached = readCachedProfile(session.user.id) || deriveDefaultProfile(session.user);
        saveCachedProfile(cached);
        set({ session, user: session.user, profile: cached, isLocalMode: false, isLoading: false });
        get().fetchProfile(session.user.id).catch(() => {});
      } else if (!get().isLocalMode) {
        set({ session: null, user: null, profile: null, isLoading: false });
      }
    });

    // Deep link handlers for desktop OAuth
    const processDeepLink = async (url: string) => {
      const urlObj = new URL(url);

      if (url.includes("access_token=")) {
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const hash = url.substring(hashIndex + 1);
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (!error && data?.user) {
              const autoProfile = deriveDefaultProfile(data.user);
              saveCachedProfile(autoProfile);
              set({
                session: data.session,
                user: data.user,
                profile: autoProfile,
                isLocalMode: false,
                isLoading: false,
              });
              // Auto-upsert to Supabase
              supabase.from("profiles").upsert({
                id: data.user.id,
                username: autoProfile.username,
                avatar_url: autoProfile.avatar_url,
                setup_complete: true,
                updated_at: new Date().toISOString(),
              }).then(null, () => {});
            }
          }
        }
      } else if (urlObj.searchParams.has("code")) {
        const code = urlObj.searchParams.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data?.user) {
            const autoProfile = deriveDefaultProfile(data.user);
            saveCachedProfile(autoProfile);
            set({
              session: data.session,
              user: data.user,
              profile: autoProfile,
              isLocalMode: false,
              isLoading: false,
            });
            supabase.from("profiles").upsert({
              id: data.user.id,
              username: autoProfile.username,
              avatar_url: autoProfile.avatar_url,
              setup_complete: true,
              updated_at: new Date().toISOString(),
            }).then(null, () => {});
          }
        }
      }
    };

    onOpenUrl(async (urls) => {
      for (const url of urls) {
        await processDeepLink(url);
      }
    }).catch(console.error);

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<string[]>("deep-link-received", async (event) => {
        for (const arg of event.payload) {
          if (arg.startsWith("vazorism://")) {
            await processDeepLink(arg);
          }
        }
      });
    }).catch(console.error);

    import("@tauri-apps/api/core").then(({ invoke }) => {
      setInterval(async () => {
        try {
          const url: string | null = await invoke("get_deep_link");
          if (url && url.startsWith("vazorism://")) {
            await processDeepLink(url);
          }
        } catch (_) {}
      }, 1000);
    }).catch(console.error);

    import("@tauri-apps/plugin-deep-link").then(async ({ getCurrent }) => {
      try {
        const payload: any = await getCurrent();
        let urlsToProcess: string[] = [];
        if (Array.isArray(payload)) {
          urlsToProcess = payload;
        } else if (payload && typeof payload === "object" && typeof payload.url === "string") {
          urlsToProcess = [payload.url];
        }
        for (const url of urlsToProcess) {
          await processDeepLink(url);
        }
      } catch (_) {}
    }).catch(console.error);
  },

  signInWithDiscord: async () => {
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
      await openUrl(data.url);
    }
  },

  signInWithGoogle: async () => {
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
      await openUrl(data.url);
    }
  },

  signOut: async () => {
    localStorage.removeItem(CACHED_PROFILE_KEY);
    localStorage.removeItem(LOCAL_PROFILE_KEY);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        localStorage.removeItem(key);
      }
    }
    set({ session: null, user: null, profile: null, isLocalMode: false, isLoading: false });
    try {
      await supabase.auth.signOut();
    } catch (_) {}
  },
}));

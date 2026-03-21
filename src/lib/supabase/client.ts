import { createBrowserClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Use createBrowserClient from @supabase/ssr for proper cookie handling in browser
export const supabase = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        cookies: {
            getAll() {
                if (typeof document === "undefined") return [];
                return document.cookie.split("; ").reduce<Array<{ name: string; value: string }>>((res, c) => {
                    const [key, ...valParts] = c.trim().split("=");
                    if (key) {
                        const val = valParts.join("=");
                        try {
                            return [...res, { name: key, value: decodeURIComponent(val) }];
                        } catch {
                            return [...res, { name: key, value: val }];
                        }
                    }
                    return res;
                }, []);
            },
            setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
                if (typeof document === "undefined") return;
                cookiesToSet.forEach(({ name, value, options }) => {
                    document.cookie = `${name}=${encodeURIComponent(value)}; path=${options?.path || "/"}; ${options?.expires ? `expires=${options.expires.toUTCString()}` : ""}; ${options?.sameSite || "lax"}`;
                });
            },
        },
    }
);

export const getSupabaseClient = () => {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing Supabase environment variables");
    }
    return supabase;
};

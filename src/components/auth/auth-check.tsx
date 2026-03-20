"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { User } from "@/types/user";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check current session - wrapped in try-catch to handle errors gracefully
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setUser(session?.user ?? null);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Auth session error:", err);
                setUser(null);
                setLoading(false);
                setError(err instanceof Error ? err.message : "Authentication failed");
            });

        // Listen for auth changes - wrapped in try-catch
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return { user, loading, error };
}

"use client";
import { useEffect } from "react";
import { useAuthStore } from "@vistafam/store";
import { getUser, onAuthStateChange } from "@vistafam/auth";
export function useAuth() {
    const { user, loading, setUser, setLoading } = useAuthStore();
    useEffect(() => {
        let mounted = true;
        async function init() {
            try {
                const currentUser = await getUser();
                if (mounted) {
                    setUser(currentUser);
                    setLoading(false);
                }
            }
            catch {
                if (mounted) {
                    setUser(null);
                    setLoading(false);
                }
            }
        }
        init();
        const subscription = onAuthStateChange((authUser) => {
            if (mounted) {
                setUser(authUser);
                setLoading(false);
            }
        });
        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [setUser, setLoading]);
    return { user, loading };
}

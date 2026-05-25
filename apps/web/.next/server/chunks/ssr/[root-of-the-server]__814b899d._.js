module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/packages/store/dist/index.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAuthStore",
    ()=>useAuthStore,
    "useUIStore",
    ()=>useUIStore,
    "useWorkspaceStore",
    ()=>useWorkspaceStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$13_$40$types$2b$react$40$19$2e$2$2e$15_react$40$19$2e$2$2e$6$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zustand@5.0.13_@types+react@19.2.15_react@19.2.6/node_modules/zustand/esm/react.mjs [app-ssr] (ecmascript)");
;
const useUIStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$13_$40$types$2b$react$40$19$2e$2$2e$15_react$40$19$2e$2$2e$6$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])((set)=>({
        sidebarOpen: true,
        rightPanelOpen: false,
        activeTab: "dashboard",
        commandPaletteOpen: false,
        theme: "dark",
        toggleSidebar: ()=>set((state)=>({
                    sidebarOpen: !state.sidebarOpen
                })),
        toggleRightPanel: ()=>set((state)=>({
                    rightPanelOpen: !state.rightPanelOpen
                })),
        setActiveTab: (tab)=>set({
                activeTab: tab
            }),
        setCommandPaletteOpen: (open)=>set({
                commandPaletteOpen: open
            }),
        setTheme: (theme)=>set({
                theme
            })
    }));
const useAuthStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$13_$40$types$2b$react$40$19$2e$2$2e$15_react$40$19$2e$2$2e$6$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])((set)=>({
        user: null,
        loading: true,
        setUser: (user)=>set({
                user
            }),
        setLoading: (loading)=>set({
                loading
            })
    }));
const useWorkspaceStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zustand$40$5$2e$0$2e$13_$40$types$2b$react$40$19$2e$2$2e$15_react$40$19$2e$2$2e$6$2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["create"])((set)=>({
        currentWorkspace: null,
        workspaces: [],
        setCurrentWorkspace: (workspace)=>set({
                currentWorkspace: workspace
            }),
        setWorkspaces: (workspaces)=>set({
                workspaces
            })
    })); //# sourceMappingURL=index.js.map
}),
"[project]/packages/database/dist/index.js [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createServiceClient",
    ()=>createServiceClient,
    "getSupabaseClient",
    ()=>getSupabaseClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$supabase$2b$supabase$2d$js$40$2$2e$106$2e$1$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@supabase+supabase-js@2.106.1/node_modules/@supabase/supabase-js/dist/index.mjs [app-ssr] (ecmascript) <locals>");
;
let client = null;
function isValidSupabaseUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.endsWith(".supabase.co") || parsed.hostname.includes("supabase");
    } catch  {
        return false;
    }
}
function getSupabaseClient() {
    if (client) return client;
    const url = typeof process !== "undefined" ? process.env.SUPABASE_URL || ("TURBOPACK compile-time value", "https://xathpxwrxfukvqffbxgu.supabase.co") : undefined;
    const key = typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY || ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdGhweHdyeGZ1a3ZxZmZieGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTMwODIsImV4cCI6MjA5NDQyOTA4Mn0.o7E4BZD6CSnZciq4DZt9xmB6oTVMirSyn7rQzA5h0qA") : undefined;
    if (!url || !key) {
        throw new Error("Supabase URL and key must be provided via environment variables. " + "Set one of the following pairs:\n" + "  - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (for client/browser)\n" + "  - SUPABASE_URL + SUPABASE_ANON_KEY (for server)");
    }
    if (!isValidSupabaseUrl(url)) {
        throw new Error(`Invalid Supabase URL: "${url}". It must be a valid Supabase project URL (e.g., https://your-project.supabase.co).`);
    }
    client = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$supabase$2b$supabase$2d$js$40$2$2e$106$2e$1$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true
        }
    });
    return client;
}
function createServiceClient() {
    const url = typeof process !== "undefined" ? process.env.SUPABASE_URL || ("TURBOPACK compile-time value", "https://xathpxwrxfukvqffbxgu.supabase.co") : undefined;
    const key = typeof process !== "undefined" ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
    if (!url || !key) {
        throw new Error("Supabase service role key must be provided");
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$supabase$2b$supabase$2d$js$40$2$2e$106$2e$1$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}
;
 //# sourceMappingURL=index.js.map
}),
"[project]/packages/auth/src/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSession",
    ()=>getSession,
    "getUser",
    ()=>getUser,
    "onAuthStateChange",
    ()=>onAuthStateChange,
    "signInWithEmail",
    ()=>signInWithEmail,
    "signInWithOAuth",
    ()=>signInWithOAuth,
    "signOut",
    ()=>signOut,
    "signUp",
    ()=>signUp
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/database/dist/index.js [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$supabase$2b$supabase$2d$js$40$2$2e$106$2e$1$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@supabase+supabase-js@2.106.1/node_modules/@supabase/supabase-js/dist/index.mjs [app-ssr] (ecmascript) <locals>");
;
function handleAuthError(err) {
    if (err instanceof Error) {
        const msg = err.message;
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
            throw new Error("Unable to reach Supabase. Check your NEXT_PUBLIC_SUPABASE_URL in .env and ensure the project exists.");
        }
        if (msg.includes("429") || msg.includes("Too Many Requests")) {
            throw new Error("Too many requests. Please wait a moment and try again.");
        }
        if (msg.includes("404") || msg.includes("Not Found")) {
            throw new Error("Supabase auth endpoint not found. Verify your NEXT_PUBLIC_SUPABASE_URL and that Auth is enabled in your Supabase project.");
        }
        throw err;
    }
    throw new Error("Authentication request failed. Please try again.");
}
async function signInWithEmail(credentials) {
    try {
        const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSupabaseClient"])();
        const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password
        });
        if (error) throw error;
        return data;
    } catch (err) {
        handleAuthError(err);
    }
}
async function signUp(credentials) {
    try {
        const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSupabaseClient"])();
        const { data, error } = await supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: {
                data: {
                    display_name: credentials.displayName
                }
            }
        });
        if (error) throw error;
        return data;
    } catch (err) {
        handleAuthError(err);
    }
}
async function signInWithOAuth(provider) {
    try {
        const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSupabaseClient"])();
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : ""}/auth/callback`
            }
        });
        if (error) throw error;
        return data;
    } catch (err) {
        handleAuthError(err);
    }
}
async function signOut() {
    try {
        const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSupabaseClient"])();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (err) {
        handleAuthError(err);
    }
}
async function getSession() {
    try {
        const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSupabaseClient"])();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    } catch (err) {
        handleAuthError(err);
    }
}
async function getUser() {
    try {
        const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSupabaseClient"])();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return null;
        const { data: profile } = await supabase.from("users").select("*").eq("id", data.user.id).single();
        if (!profile) {
            // Fallback: allow app to proceed with minimal user derived from auth session
            const u = data.user;
            return {
                id: u.id,
                email: u.email || "",
                displayName: u.user_metadata?.display_name || u.user_metadata?.name || u.user_metadata?.full_name || null,
                avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
                role: "member",
                status: "online",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        return {
            id: profile.id,
            email: profile.email,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            role: profile.role,
            status: profile.status,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at
        };
    } catch (err) {
        handleAuthError(err);
    }
}
function onAuthStateChange(callback) {
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSupabaseClient"])();
    const { data } = supabase.auth.onAuthStateChange(async (_event, session)=>{
        if (session?.user) {
            try {
                const user = await getUser();
                callback(user);
            } catch  {
                callback(null);
            }
        } else {
            callback(null);
        }
    });
    return data.subscription;
}
;
}),
"[project]/packages/hooks/dist/use-auth.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$6_react$40$19$2e$2$2e$6_$5f$react$40$19$2e$2$2e$6$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.18_@opentelemetry+api@1.9.1_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$store$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/store/dist/index.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$auth$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/auth/src/index.ts [app-ssr] (ecmascript) <locals>");
;
;
;
function useAuth() {
    const { user, loading, setUser, setLoading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$store$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$6_react$40$19$2e$2$2e$6_$5f$react$40$19$2e$2$2e$6$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let mounted = true;
        async function init() {
            try {
                const currentUser = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$auth$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getUser"])();
                if (mounted) {
                    setUser(currentUser);
                    setLoading(false);
                }
            } catch  {
                if (mounted) {
                    setUser(null);
                    setLoading(false);
                }
            }
        }
        init();
        const subscription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$auth$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["onAuthStateChange"])((authUser)=>{
            if (mounted) {
                setUser(authUser);
                setLoading(false);
            }
        });
        return ()=>{
            mounted = false;
            subscription.unsubscribe();
        };
    }, [
        setUser,
        setLoading
    ]);
    return {
        user,
        loading
    };
} //# sourceMappingURL=use-auth.js.map
}),
"[project]/packages/hooks/dist/use-workspace.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useCreateWorkspace",
    ()=>useCreateWorkspace,
    "useWorkspaces",
    ()=>useWorkspaces
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$100$2e$12_react$40$19$2e$2$2e$6$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tanstack+react-query@5.100.12_react@19.2.6/node_modules/@tanstack/react-query/build/modern/useQuery.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$100$2e$12_react$40$19$2e$2$2e$6$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tanstack+react-query@5.100.12_react@19.2.6/node_modules/@tanstack/react-query/build/modern/useMutation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$100$2e$12_react$40$19$2e$2$2e$6$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tanstack+react-query@5.100.12_react@19.2.6/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/database/dist/index.js [app-ssr] (ecmascript) <locals>");
;
;
function useWorkspaces() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$100$2e$12_react$40$19$2e$2$2e$6$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useQuery"])({
        queryKey: [
            "workspaces"
        ],
        queryFn: async ()=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSupabaseClient"])();
            const { data, error } = await supabase.from("workspaces").select("*").order("created_at", {
                ascending: false
            });
            if (error) throw error;
            return data;
        }
    });
}
function useCreateWorkspace() {
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$100$2e$12_react$40$19$2e$2$2e$6$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useQueryClient"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$100$2e$12_react$40$19$2e$2$2e$6$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMutation"])({
        mutationFn: async (input)=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$database$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getSupabaseClient"])();
            const { data, error } = await supabase.from("workspaces").insert({
                name: input.name,
                slug: input.slug,
                description: input.description,
                color: input.color
            }).select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: ()=>{
            queryClient.invalidateQueries({
                queryKey: [
                    "workspaces"
                ]
            });
        }
    });
} //# sourceMappingURL=use-workspace.js.map
}),
"[project]/packages/hooks/dist/use-query-client.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "queryClient",
    ()=>queryClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$query$2d$core$40$5$2e$100$2e$12$2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$queryClient$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tanstack+query-core@5.100.12/node_modules/@tanstack/query-core/build/modern/queryClient.js [app-ssr] (ecmascript)");
;
const queryClient = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$query$2d$core$40$5$2e$100$2e$12$2f$node_modules$2f40$tanstack$2f$query$2d$core$2f$build$2f$modern$2f$queryClient$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["QueryClient"]({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1
        }
    }
}); //# sourceMappingURL=use-query-client.js.map
}),
"[project]/packages/hooks/dist/index.js [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$hooks$2f$dist$2f$use$2d$auth$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/hooks/dist/use-auth.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$hooks$2f$dist$2f$use$2d$workspace$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/hooks/dist/use-workspace.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$hooks$2f$dist$2f$use$2d$query$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/hooks/dist/use-query-client.js [app-ssr] (ecmascript)"); //# sourceMappingURL=index.js.map
;
;
;
}),
"[project]/apps/web/app/providers.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Providers",
    ()=>Providers
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$6_react$40$19$2e$2$2e$6_$5f$react$40$19$2e$2$2e$6$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.18_@opentelemetry+api@1.9.1_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$100$2e$12_react$40$19$2e$2$2e$6$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@tanstack+react-query@5.100.12_react@19.2.6/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$hooks$2f$dist$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/hooks/dist/index.js [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$hooks$2f$dist$2f$use$2d$query$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/hooks/dist/use-query-client.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$themes$40$0$2e$4$2e$6_react$2d$dom$40$19$2e$2$2e$6_react$40$19$2e$2$2e$6_$5f$react$40$19$2e$2$2e$6$2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next-themes@0.4.6_react-dom@19.2.6_react@19.2.6__react@19.2.6/node_modules/next-themes/dist/index.mjs [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function Providers({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$6_react$40$19$2e$2$2e$6_$5f$react$40$19$2e$2$2e$6$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$2d$themes$40$0$2e$4$2e$6_react$2d$dom$40$19$2e$2$2e$6_react$40$19$2e$2$2e$6_$5f$react$40$19$2e$2$2e$6$2f$node_modules$2f$next$2d$themes$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ThemeProvider"], {
        attribute: "class",
        defaultTheme: "dark",
        enableSystem: false,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$6_react$40$19$2e$2$2e$6_$5f$react$40$19$2e$2$2e$6$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$tanstack$2b$react$2d$query$40$5$2e$100$2e$12_react$40$19$2e$2$2e$6$2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["QueryClientProvider"], {
            client: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$hooks$2f$dist$2f$use$2d$query$2d$client$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["queryClient"],
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/app/providers.tsx",
            lineNumber: 10,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/app/providers.tsx",
        lineNumber: 9,
        columnNumber: 5
    }, this);
}
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/dynamic-access-async-storage.external.js [external] (next/dist/server/app-render/dynamic-access-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/dynamic-access-async-storage.external.js", () => require("next/dist/server/app-render/dynamic-access-async-storage.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__814b899d._.js.map
import { create } from "zustand";
export const useUIStore = create((set) => ({
    sidebarOpen: true,
    rightPanelOpen: false,
    activeTab: "dashboard",
    commandPaletteOpen: false,
    theme: "dark",
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    setTheme: (theme) => set({ theme }),
}));
export const useAuthStore = create((set) => ({
    user: null,
    loading: true,
    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ loading }),
}));
export const useWorkspaceStore = create((set) => ({
    currentWorkspace: null,
    workspaces: [],
    setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
    setWorkspaces: (workspaces) => set({ workspaces }),
}));

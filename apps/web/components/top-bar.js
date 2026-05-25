"use client";
import { Search, Bell, LogOut } from "lucide-react";
import { signOut } from "@vistafam/auth";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
export function TopBar() {
    const { user } = useAuth();
    const handleLogout = async () => {
        try {
            await signOut();
            toast.success("Signed out successfully");
            window.location.href = "/auth";
        }
        catch {
            toast.error("Failed to sign out");
        }
    };
    return (<header className="h-14 border-b border-white/5 bg-[#080808]/60 backdrop-blur-md flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"/>
          <input type="text" placeholder="Search projects, tasks, docs..." className="glass-input w-full pl-9 text-xs"/>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-white/40 hover:text-white/70 hover:bg-white/[0.05] rounded-lg transition-all">
          <Bell className="h-4 w-4"/>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full"/>
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-white/90">{user?.displayName || "User"}</p>
            <p className="text-[10px] text-white/40">{user?.role || "Member"}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-white/80">
            {(user?.displayName || "U").charAt(0).toUpperCase()}
          </div>
          <button onClick={handleLogout} className="p-2 text-white/30 hover:text-white/60 hover:bg-white/[0.05] rounded-lg transition-all">
            <LogOut className="h-4 w-4"/>
          </button>
        </div>
      </div>
    </header>);
}

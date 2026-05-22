"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@pipesync/database";
import { motion } from "framer-motion";
import { FolderKanban, CheckSquare, MessageSquare, Users } from "lucide-react";

export function DashboardView() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const [{ count: projects }, { count: tasks }, { count: channels }] = await Promise.all([
        supabase.from("projects").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*", { count: "exact", head: true }),
        supabase.from("channels").select("*", { count: "exact", head: true }),
      ]);
      return { projects: projects || 0, tasks: tasks || 0, channels: channels || 0 };
    },
  });

  const cards = [
    { label: "Projects", value: stats?.projects || 0, icon: FolderKanban, color: "from-blue-500/20 to-blue-600/10" },
    { label: "Tasks", value: stats?.tasks || 0, icon: CheckSquare, color: "from-green-500/20 to-green-600/10" },
    { label: "Channels", value: stats?.channels || 0, icon: MessageSquare, color: "from-purple-500/20 to-purple-600/10" },
    { label: "Team Members", value: 1, icon: Users, color: "from-orange-500/20 to-orange-600/10" },
  ];

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white/90">Dashboard</h2>
        <p className="text-sm text-white/40">Welcome back to your workspace</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-5"
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-4`}>
                <Icon className="h-5 w-5 text-white/80" />
              </div>
              <p className="text-2xl font-bold text-white/90">{card.value}</p>
              <p className="text-sm text-white/40">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/80 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <CheckSquare className="h-4 w-4 text-white/40" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white/70">Task updated</p>
                  <p className="text-xs text-white/30">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/80 mb-4">Active Projects</h3>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/70">Project {i}</p>
                  <span className="text-xs text-white/30">{i * 25}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${i * 25}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

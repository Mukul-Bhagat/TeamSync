"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@vistafam/database";
import { motion } from "framer-motion";
import { Activity, FolderKanban, CheckSquare, MessageSquare, UserPlus } from "lucide-react";
import type { Activity as ActivityItem } from "@vistafam/types";

const activityIcons: Record<string, React.ElementType> = {
  project_created: FolderKanban,
  task_created: CheckSquare,
  message_sent: MessageSquare,
  member_joined: UserPlus,
};

export function ActivityView() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as ActivityItem[];
    },
  });

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white/90">Activity Feed</h2>
        <p className="text-sm text-white/40">Recent workspace events</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-card h-16 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {activities?.map((activity, i) => {
            const Icon = activityIcons[activity.type] || Activity;
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card-hover p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center">
                  <Icon className="h-5 w-5 text-white/40" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white/80">
                    <span className="font-semibold">{activity.actorName}</span>{" "}
                    {activity.type.replace("_", " ")}
                  </p>
                  <p className="text-xs text-white/30">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              </motion.div>
            );
          })}
          {(!activities || activities.length === 0) && (
            <div className="text-center py-20">
              <Activity className="h-12 w-12 mx-auto text-white/10 mb-4" />
              <p className="text-sm text-white/30">No activity yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

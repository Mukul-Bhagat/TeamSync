"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@pipesync/database";
import { motion } from "framer-motion";
import { Plus, CheckSquare, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import type { Task, TaskStatus } from "@pipesync/types";

const statusColors: Record<TaskStatus, string> = {
  todo: "bg-white/5 text-white/40",
  in_progress: "bg-blue-500/10 text-blue-400",
  review: "bg-yellow-500/10 text-yellow-400",
  done: "bg-green-500/10 text-green-400",
};

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

export function TasksView() {
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (taskTitle: string) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("tasks").insert({ title: taskTitle, status: "todo", priority: "medium" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowNew(false);
      setTitle("");
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white/90">Tasks</h2>
          <p className="text-sm text-white/40">Track your work</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {showNew && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 mb-6"
        >
          <div className="flex gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="glass-input flex-1"
              onKeyDown={(e) => e.key === "Enter" && createTask.mutate(title)}
            />
            <button
              onClick={() => createTask.mutate(title)}
              disabled={!title.trim() || createTask.isPending}
              className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="h-9 px-4 glass-input text-sm hover:bg-white/[0.06]"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-16 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks?.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card-hover p-4 flex items-center gap-4"
            >
              <button
                onClick={() => updateStatus.mutate({ id: task.id, status: task.status === "done" ? "todo" : "done" })}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                  task.status === "done" ? "bg-green-500/20 border-green-500/50" : "border-white/20 hover:border-white/40"
                }`}
              >
                {task.status === "done" && <CheckSquare className="h-3 w-3 text-green-400" />}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${task.status === "done" ? "line-through text-white/30" : "text-white/90"}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[task.status]}`}>
                    {statusLabels[task.status]}
                  </span>
                  {task.dueDate && (
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                  <User className="h-3 w-3 text-white/30" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

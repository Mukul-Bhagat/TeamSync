"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@vistafam/database";
import { motion } from "framer-motion";
import { Plus, FolderKanban, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@vistafam/types";

export function ProjectsView() {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const createProject = useMutation({
    mutationFn: async (projectName: string) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("projects").insert({ name: projectName, status: "planning" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowNew(false);
      setName("");
      toast.success("Project created");
    },
    onError: () => toast.error("Failed to create project"),
  });

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white/90">Projects</h2>
          <p className="text-sm text-white/40">Manage your workspaces</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Project
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="glass-input flex-1"
              onKeyDown={(e) => e.key === "Enter" && createProject.mutate(name)}
            />
            <button
              onClick={() => createProject.mutate(name)}
              disabled={!name.trim() || createProject.isPending}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card-hover p-5 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FolderKanban className="h-5 w-5 text-blue-400" />
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  project.status === "active" ? "bg-green-500/10 text-green-400" :
                  project.status === "planning" ? "bg-blue-500/10 text-blue-400" :
                  "bg-white/5 text-white/40"
                }`}>
                  {project.status}
                </span>
              </div>
              <h3 className="font-semibold text-white/90 mb-1">{project.name}</h3>
              <p className="text-xs text-white/30 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

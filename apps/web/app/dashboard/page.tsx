"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { DashboardView } from "@/components/views/dashboard-view";
import { ProjectsView } from "@/components/views/projects-view";
import { TasksView } from "@/components/views/tasks-view";
import { ChatView } from "@/components/views/chat-view";
import { ActivityView } from "@/components/views/activity-view";
import { KnowledgeView } from "@/components/views/knowledge-view";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#020202]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Client-side redirect to auth
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
    return null;
  }

  const views: Record<string, React.ReactNode> = {
    dashboard: <DashboardView />,
    projects: <ProjectsView />,
    tasks: <TasksView />,
    chat: <ChatView />,
    activity: <ActivityView />,
    knowledge: <KnowledgeView />,
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#050505] text-foreground overflow-hidden font-sans">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 flex flex-col border-x border-white/5 relative z-10 bg-black/20 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              {views[activeTab] || <DashboardView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

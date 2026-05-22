"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@pipesync/database";
import { motion } from "framer-motion";
import { BookOpen, FileText, ChevronRight } from "lucide-react";
import type { KnowledgePage, KnowledgeCategory } from "@pipesync/types";

export function KnowledgeView() {
  const [selectedPage, setSelectedPage] = useState<KnowledgePage | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("knowledge_categories").select("*").order("position");
      if (error) throw error;
      return data as KnowledgeCategory[];
    },
  });

  const { data: pages } = useQuery({
    queryKey: ["knowledge-pages"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("knowledge_pages").select("*").order("position");
      if (error) throw error;
      return data as KnowledgePage[];
    },
  });

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-white/5 bg-[#080808]/40 flex flex-col overflow-auto scrollbar-thin">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Knowledge Base</h3>
        </div>
        <div className="p-3 space-y-1">
          {categories?.map((category) => (
            <div key={category.id}>
              <div className="px-3 py-2 text-xs font-semibold text-white/50 uppercase tracking-wider">
                {category.name}
              </div>
              {pages
                ?.filter((p) => p.categoryId === category.id)
                .map((page) => (
                  <button
                    key={page.id}
                    onClick={() => setSelectedPage(page)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedPage?.id === page.id
                        ? "bg-white/[0.06] text-white/90"
                        : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {page.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 scrollbar-thin">
        {selectedPage ? (
          <motion.div
            key={selectedPage.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-3xl"
          >
            <h1 className="text-2xl font-bold text-white/90 mb-2">{selectedPage.title}</h1>
            <div className="flex items-center gap-2 text-xs text-white/30 mb-6">
              <BookOpen className="h-3 w-3" />
              <span>Updated {new Date(selectedPage.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="text-white/70 leading-relaxed whitespace-pre-wrap">{selectedPage.content}</div>
            </div>
          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <BookOpen className="h-16 w-16 text-white/10 mb-4" />
            <h3 className="text-lg font-semibold text-white/40 mb-2">Knowledge Base</h3>
            <p className="text-sm text-white/20 max-w-md">
              Select a page from the sidebar to view documentation, guides, and team knowledge.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

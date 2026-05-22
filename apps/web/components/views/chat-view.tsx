"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@pipesync/database";
import { motion } from "framer-motion";
import { Hash, Send, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Channel, Message } from "@pipesync/types";

export function ChatView() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: channels } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("channels").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data as Channel[];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedChannel?.id],
    queryFn: async () => {
      if (!selectedChannel) return [];
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", selectedChannel.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedChannel,
  });

  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedChannel) return;
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("messages").insert({
        channel_id: selectedChannel.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChannel?.id] });
      setInputValue("");
    },
    onError: () => toast.error("Failed to send message"),
  });

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-white/5 bg-[#080808]/40 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Channels</h3>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {channels?.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setSelectedChannel(channel)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                selectedChannel?.id === channel.id
                  ? "bg-white/[0.06] text-white/90"
                  : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
              }`}
            >
              <Hash className="h-4 w-4" />
              {channel.name}
            </button>
          ))}
        </div>
        <button className="m-3 h-9 glass-input flex items-center justify-center gap-2 text-sm hover:bg-white/[0.06]">
          <Plus className="h-4 w-4" />
          Add Channel
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedChannel && (
          <>
            <div className="h-14 flex items-center px-6 border-b border-white/5 bg-black/10">
              <div className="flex items-center gap-2 text-white/90">
                <Hash className="h-5 w-5 text-white/30" />
                <span className="font-bold tracking-tight">{selectedChannel.name}</span>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-6 scrollbar-thin">
              {messages?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                  <Hash className="h-12 w-12 mb-4 text-white/20" />
                  <p className="text-sm font-medium">This is the start of #{selectedChannel.name}</p>
                </div>
              )}
              {messages?.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-white/60">
                    {(message.senderName || "U").charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white/80">{message.senderName || "User"}</span>
                      <span className="text-[10px] text-white/30">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-white/70 mt-0.5">{message.content}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="p-4 px-6">
              <div className="flex gap-3">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (inputValue.trim()) sendMessage.mutate(inputValue);
                    }
                  }}
                  placeholder={`Message #${selectedChannel.name}`}
                  className="glass-input flex-1"
                />
                <button
                  onClick={() => inputValue.trim() && sendMessage.mutate(inputValue)}
                  disabled={!inputValue.trim() || sendMessage.isPending}
                  className="h-10 w-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

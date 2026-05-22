import { getSupabaseClient } from "@vistafam/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SubscriptionCallback<T> = (payload: T) => void;

export class RealtimeService {
  private channels = new Map<string, RealtimeChannel>();

  subscribe<T extends Record<string, unknown>>(
    table: string,
    callback: SubscriptionCallback<T>,
    filter?: { event?: "INSERT" | "UPDATE" | "DELETE" | "*"; filter?: string }
  ) {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`public:${table}`)
      .on(
        "postgres_changes",
        {
          event: filter?.event || "*",
          schema: "public",
          table,
          filter: filter?.filter,
        },
        (payload: { new: T }) => callback(payload.new)
      )
      .subscribe();

    this.channels.set(table, channel);
    return () => this.unsubscribe(table);
  }

  unsubscribe(table: string) {
    const channel = this.channels.get(table);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(table);
    }
  }

  unsubscribeAll() {
    for (const [table, channel] of this.channels) {
      channel.unsubscribe();
      this.channels.delete(table);
    }
  }
}

export const realtimeService = new RealtimeService();

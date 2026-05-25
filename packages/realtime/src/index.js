import { getSupabaseClient } from "@vistafam/database";
export class RealtimeService {
    channels = new Map();
    subscribe(table, callback, filter) {
        const supabase = getSupabaseClient();
        const channel = supabase
            .channel(`public:${table}`)
            .on("postgres_changes", {
            event: filter?.event || "*",
            schema: "public",
            table,
            filter: filter?.filter,
        }, (payload) => callback(payload.new))
            .subscribe();
        this.channels.set(table, channel);
        return () => this.unsubscribe(table);
    }
    unsubscribe(table) {
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

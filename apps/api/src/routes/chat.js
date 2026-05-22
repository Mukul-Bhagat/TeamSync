import { createServiceClient } from "@vistafam/database";
export async function chatRoutes(app) {
    app.get("/channels", async (request, reply) => {
        const supabase = createServiceClient();
        const { data, error } = await supabase.from("channels").select("*").order("created_at", { ascending: true });
        if (error) {
            reply.status(500).send({ success: false, message: error.message });
            return;
        }
        reply.send({ success: true, message: "Channels fetched", data });
    });
    app.get("/channels/:id/messages", async (request, reply) => {
        const { id } = request.params;
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("channel_id", id)
            .order("created_at", { ascending: true });
        if (error) {
            reply.status(500).send({ success: false, message: error.message });
            return;
        }
        reply.send({ success: true, message: "Messages fetched", data });
    });
}

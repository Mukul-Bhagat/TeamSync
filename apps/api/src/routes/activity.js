import { createServiceClient } from "@vistafam/database";
export async function activityRoutes(app) {
    app.get("/", async (request, reply) => {
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from("activity_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50);
        if (error) {
            reply.status(500).send({ success: false, message: error.message });
            return;
        }
        reply.send({ success: true, message: "Activity fetched", data });
    });
}

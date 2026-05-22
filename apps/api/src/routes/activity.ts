import type { FastifyInstance } from "fastify";
import { createServiceClient } from "@pipesync/database";

export async function activityRoutes(app: FastifyInstance) {
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

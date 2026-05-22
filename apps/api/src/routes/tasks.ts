import type { FastifyInstance } from "fastify";
import { createServiceClient } from "@pipesync/database";
import { createTaskSchema } from "@pipesync/validation";

export async function taskRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (error) {
      reply.status(500).send({ success: false, message: error.message });
      return;
    }
    reply.send({ success: true, message: "Tasks fetched", data });
  });

  app.post("/", async (request, reply) => {
    const parse = createTaskSchema.safeParse(request.body);
    if (!parse.success) {
      reply.status(400).send({ success: false, message: parse.error.errors[0].message });
      return;
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase.from("tasks").insert(parse.data).select().single();
    if (error) {
      reply.status(500).send({ success: false, message: error.message });
      return;
    }
    reply.status(201).send({ success: true, message: "Task created", data });
  });
}

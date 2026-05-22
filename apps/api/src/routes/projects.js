import { createServiceClient } from "@vistafam/database";
import { createProjectSchema } from "@vistafam/validation";
export async function projectRoutes(app) {
    app.get("/", async (request, reply) => {
        const supabase = createServiceClient();
        const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
        if (error) {
            reply.status(500).send({ success: false, message: error.message });
            return;
        }
        reply.send({ success: true, message: "Projects fetched", data });
    });
    app.post("/", async (request, reply) => {
        const parse = createProjectSchema.safeParse(request.body);
        if (!parse.success) {
            reply.status(400).send({ success: false, message: parse.error.errors[0].message });
            return;
        }
        const supabase = createServiceClient();
        const { data, error } = await supabase.from("projects").insert(parse.data).select().single();
        if (error) {
            reply.status(500).send({ success: false, message: error.message });
            return;
        }
        reply.status(201).send({ success: true, message: "Project created", data });
    });
}

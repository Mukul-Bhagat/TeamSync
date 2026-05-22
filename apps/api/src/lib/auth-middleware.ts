import type { FastifyRequest, FastifyReply } from "fastify";
import { createServiceClient } from "@vistafam/database";

export async function verifyAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.status(401).send({ success: false, message: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    reply.status(401).send({ success: false, message: "Invalid token" });
    return;
  }

  request.user = {
    id: data.user.id,
    email: data.user.email || "",
  };
}

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email: string };
  }
}

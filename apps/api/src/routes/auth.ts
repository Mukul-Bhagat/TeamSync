import type { FastifyInstance } from "fastify";

export async function authRoutes(app: FastifyInstance) {
  app.get("/me", async (request, reply) => {
    if (!request.user) {
      reply.status(401).send({ success: false, message: "Unauthorized" });
      return;
    }
    reply.send({
      success: true,
      message: "User profile",
      data: request.user,
    });
  });
}

import type { FastifyInstance } from "fastify";
import { verifyAuth } from "../lib/auth-middleware";
import { authRoutes } from "./auth";
import { projectRoutes } from "./projects";
import { taskRoutes } from "./tasks";
import { chatRoutes } from "./chat";
import { activityRoutes } from "./activity";

export async function apiRoutes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: "/auth" });

  app.addHook("onRequest", verifyAuth);

  app.register(projectRoutes, { prefix: "/projects" });
  app.register(taskRoutes, { prefix: "/tasks" });
  app.register(chatRoutes, { prefix: "/chat" });
  app.register(activityRoutes, { prefix: "/activity" });
}

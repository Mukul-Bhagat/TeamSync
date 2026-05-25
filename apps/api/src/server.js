import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createLogger } from "@vistafam/logger";
import { apiRoutes } from "./routes";
import { errorHandler } from "./lib/error-handler";
const logger = createLogger("legacy-api");
const app = Fastify({
    logger: false,
    trustProxy: true,
});
app.setErrorHandler(errorHandler);
async function start() {
    await app.register(cors, {
        origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
        credentials: true,
    });
    await app.register(helmet, {
        contentSecurityPolicy: false,
    });
    await app.register(rateLimit, {
        max: 100,
        timeWindow: "1 minute",
    });
    await app.register(apiRoutes, { prefix: "/v1" });
    app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
    const port = Number(process.env.API_PORT) || 4000;
    const host = process.env.API_HOST || "0.0.0.0";
    try {
        await app.listen({ port, host });
        logger.info(`API server running at http://${host}:${port}`);
    }
    catch (err) {
        logger.error("Failed to start server", { error: String(err) });
        process.exit(1);
    }
}
start();

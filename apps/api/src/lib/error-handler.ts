import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { createLogger } from "@vistafam/logger";

const logger = createLogger("legacy-api");

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  logger.error("Request error", {
    url: request.url,
    method: request.method,
    error: error.message,
    statusCode: error.statusCode,
  });

  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? "Internal server error" : error.message;

  reply.status(statusCode).send({
    success: false,
    message,
    error: {
      code: error.code || "UNKNOWN_ERROR",
      message: error.message,
    },
  });
}

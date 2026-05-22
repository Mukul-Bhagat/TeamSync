# Generic PipeVista Service Dockerfile
# Usage: docker build -f docker/pipevista.Dockerfile --build-arg SERVICE=pipevista-event-hub .

ARG SERVICE
FROM node:20-alpine AS builder
ARG SERVICE
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY packages/pipevista-core/package.json packages/pipevista-core/tsconfig.json ./packages/pipevista-core/
COPY apps/${SERVICE}/package.json apps/${SERVICE}/tsconfig.json ./apps/${SERVICE}/
RUN pnpm install --frozen-lockfile
COPY packages/pipevista-core/src ./packages/pipevista-core/src
COPY apps/${SERVICE}/src ./apps/${SERVICE}/src
RUN pnpm --filter @vistafam/pipevista-core build
RUN pnpm --filter @vistafam/${SERVICE} build

FROM node:20-alpine AS runtime
ARG SERVICE
WORKDIR /app
COPY --from=builder /app/apps/${SERVICE}/dist ./dist
COPY --from=builder /app/apps/${SERVICE}/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
ENV NODE_ENV=production
EXPOSE 4100-4107
CMD ["node", "dist/main.js"]

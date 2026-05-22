# PipeVista Gateway Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY packages/pipevista-core/package.json packages/pipevista-core/tsconfig.json ./packages/pipevista-core/
COPY apps/pipevista-gateway/package.json apps/pipevista-gateway/tsconfig.json ./apps/pipevista-gateway/
RUN pnpm install --frozen-lockfile
COPY packages/pipevista-core/src ./packages/pipevista-core/src
COPY apps/pipevista-gateway/src ./apps/pipevista-gateway/src
RUN pnpm --filter @vistafam/pipevista-core build
RUN pnpm --filter @vistafam/pipevista-gateway build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/apps/pipevista-gateway/dist ./dist
COPY --from=builder /app/apps/pipevista-gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
ENV NODE_ENV=production
EXPOSE 4100
CMD ["node", "dist/main.js"]

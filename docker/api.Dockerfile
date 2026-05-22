FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build --filter=@pipesync/api
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]

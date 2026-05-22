FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build --filter=@pipesync/web
EXPOSE 3000
CMD ["pnpm", "dev", "--filter=@pipesync/web"]

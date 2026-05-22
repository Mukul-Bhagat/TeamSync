FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build --filter=@teamsync/web

FROM base AS runner
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/apps/web/dist /usr/src/app/apps/web/dist
COPY --from=build /usr/src/app/apps/web/package.json /usr/src/app/apps/web/package.json
COPY --from=build /usr/src/app/node_modules /usr/src/app/node_modules

EXPOSE 3000
CMD [ "node", "apps/web/dist/server.cjs" ]

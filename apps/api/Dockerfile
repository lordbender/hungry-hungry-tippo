FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w @hhh/contracts
RUN npm run build -w @hhh/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/src/migrations ./apps/api/src/migrations
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
CMD ["npm", "run", "start", "-w", "@hhh/api"]

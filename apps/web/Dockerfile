FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build -w @hhh/contracts
RUN npm run build -w @hhh/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

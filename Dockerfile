FROM node:18.20.8-alpine3.21 AS builder

ENV HUSKY=0

# Install pnpm
RUN npm install -g pnpm@8.6.6

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# devDeps are needed for the build below (tsc)
RUN pnpm i --no-frozen-lockfile

COPY . .

RUN pnpm run build
# pruned to prod-only before the final image copies node_modules
RUN pnpm prune --production

FROM gcr.io/distroless/nodejs18-debian11 AS production


ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package.json .

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

EXPOSE 3000

USER node
CMD [ "--es-module-specifier-resolution=node", "/usr/src/app/dist/index.js" ]
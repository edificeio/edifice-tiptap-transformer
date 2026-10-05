FROM node:18.20.8-alpine3.21 AS builder

ENV HUSKY=0

# Install pnpm
RUN npm install -g pnpm@8.6.6

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN pnpm i --prod --no-frozen-lockfile

COPY . .

RUN pnpm run build
RUN pnpm prune --production

# Used by CI / docker-compose to run the test suite (unit, integration, e2e)
# in a clean environment matching production's Node version, with the full
# devDependencies (vitest, supertest, tsx) that "production" prunes away.
FROM node:18.20.8-alpine3.21 AS test

ENV HUSKY=0

RUN npm install -g pnpm@8.6.6

WORKDIR /usr/src/app

COPY package*.json ./

RUN pnpm i --no-frozen-lockfile

COPY . .

CMD ["pnpm", "test"]

FROM gcr.io/distroless/nodejs18-debian11 AS production


ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package.json .

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

EXPOSE 3000

USER node
CMD [ "--es-module-specifier-resolution=node", "/usr/src/app/dist/index.js" ]
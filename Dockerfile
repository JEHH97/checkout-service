FROM node:26.3.0-alpine3.22 AS build
WORKDIR /app
COPY package*.json ./
COPY scripts/in-dev ./scripts/in-dev
RUN chmod +x scripts/in-dev && scripts/in-dev npm ci
COPY . .
RUN scripts/in-dev npx prisma generate && scripts/in-dev npm run build

FROM node:26.3.0-alpine3.22
ENV NODE_ENV=production
WORKDIR /app
ENV NPM_CONFIG_CACHE=/tmp/.npm
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chown -R node:node /app/node_modules/.prisma && chmod 0555 /usr/local/bin/docker-entrypoint.sh
USER node
LABEL org.opencontainers.image.source="https://github.com/JEHH97/checkout-service" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="Checkout Service" \
      org.opencontainers.image.description="A resilient orders and payments API built with NestJS, PostgreSQL, and Redis."
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

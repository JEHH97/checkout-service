FROM node:24.22.3-alpine3.23@sha256:3946fb783fdce8a2812136ea694bc95c698c4f4096f3fd18568dc27a8ac389dc AS build
WORKDIR /app
COPY package*.json ./
COPY scripts/in-dev ./scripts/in-dev
RUN chmod +x scripts/in-dev && scripts/in-dev npm ci
COPY . .
RUN scripts/in-dev npx prisma generate && scripts/in-dev npm run build

FROM node:24.22.3-alpine3.23@sha256:3946fb783fdce8a2812136ea694bc95c698c4f4096f3fd18568dc27a8ac389dc
ENV NODE_ENV=production
WORKDIR /app
ENV NPM_CONFIG_CACHE=/tmp/.npm
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma /opt/prisma-client
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# npm is a build-time tool only; remove it from the runtime image to reduce
# unnecessary attack surface and keep its bundled dependency tree out of prod.
RUN chown -R node:node /app/node_modules/.prisma /opt/prisma-client \
    && chmod 0555 /usr/local/bin/docker-entrypoint.sh \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER node
LABEL org.opencontainers.image.source="https://github.com/JEHH97/checkout-service" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="Checkout Service" \
      org.opencontainers.image.description="A resilient orders and payments API built with NestJS, PostgreSQL, and Redis."
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

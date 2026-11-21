FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY scripts/in-dev ./scripts/in-dev
RUN chmod +x scripts/in-dev && scripts/in-dev npm ci
COPY . .
RUN scripts/in-dev npx prisma generate && scripts/in-dev npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/scripts/in-dev ./scripts/in-dev
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["scripts/in-dev", "sh", "-c", "scripts/in-dev npx prisma db push && if [ \"${RUN_SEED:-false}\" = \"true\" ]; then scripts/in-dev npm run seed; fi && scripts/in-dev node dist/main.js"]

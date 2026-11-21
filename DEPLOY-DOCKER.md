# Deploy the Docker demo

This guide runs `ghcr.io/jehh97/checkout-service` with PostgreSQL and Redis hosted in Docker Compose on a server you control. The API listens on container port `3000`; only the API port is published. PostgreSQL and Redis are private to the Compose network.

## Images and runtime settings

The publishing workflow creates version tags (`vX.Y.Z`) and `sha-<short-commit>`; it does not publish a floating `latest` tag. The default release is `v1.0.1`. Images target `linux/amd64`, run as the unprivileged `node` user, and have a dependency-aware healthcheck at `/health`.

If the GHCR package is private, authenticate on the deployment host with a GitHub PAT that has `read:packages`:

```sh
echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

Keep the token outside shell history and revoke it when it is no longer needed. Public packages can be pulled anonymously.

Copy the example environment and replace every placeholder. Generate different secrets for PostgreSQL, Redis, and JWT with `openssl rand -hex 32`. The database and Redis URL passwords must match the service passwords; hex values need no URL escaping.

```sh
cp deploy/.env.example deploy/.env
openssl rand -hex 32 # repeat separately for POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET
```

`APP_BIND_ADDRESS` and `APP_PORT` control the host binding (defaults `127.0.0.1` and `3001`); the container port is always `3000`. Set `JWT_EXPIRES_IN` to the required token lifetime, and configure `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies (default `1`). Never trust forwarded headers from untrusted clients.

`RUN_DB_PUSH=true` applies the Prisma schema at startup (the default); set it to `false` only if schema rollout is managed separately. `RUN_SEED=true` runs the idempotent demo seed at startup; set it to `false` to disable the public demo account and products. Repeated seeding resets the demo account password to `DemoAdmin2026!`.

For the demo flow, keep `PAYMENT_ADAPTER=fake` and `DEMO_MODE=true`. The fake payment route is for demonstrations only; do not use these settings for a production payment service.

```sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml ps
```

The container applies Prisma `db push`, optionally seeds, then starts the API as UID `node`. The root filesystem is read-only; `/tmp` is tmpfs, and the generated Prisma client uses a writable named volume refreshed from the image before startup. PostgreSQL and Redis also run read-only with dropped capabilities, readiness healthchecks, and persistent data volumes; neither has a host-published port. Compose enforces per-service memory and process limits.

## TLS reverse proxy

Terminate TLS at a reverse proxy. The API binds to loopback by default (`APP_BIND_ADDRESS=127.0.0.1`). For Caddy, use:

```caddyfile
checkout.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

Allow inbound HTTPS only at the proxy/firewall. The root path redirects to Swagger at `/docs`; liveness is `/health/live` and the dependency-aware health endpoint is `/health`.

## Verify the demo

Use the public hostname in place of `checkout.example.com`.

```sh
curl -fsS https://checkout.example.com/health
curl -fsS https://checkout.example.com/docs
curl -fsS -X POST https://checkout.example.com/auth/login \
  -H 'Content-Type: application/json' \
  --data '{"email":"admin@example.test","password":"DemoAdmin2026!"}'
```

Copy the returned `accessToken` into `TOKEN` without saving it in shell history. Use Swagger or curl to run the authenticated checkout flow:

1. `GET /products` and select a product ID.
2. `POST /cart/items` with `{"productId":"desk-lamp","quantity":1}`.
3. `POST /orders` with `Authorization: Bearer $TOKEN` and a unique `Idempotency-Key`; record the returned order ID.
4. `POST /payments/ORDER_ID/intents` with a different unique idempotency key.
5. `POST /demo/orders/ORDER_ID/pay` with the same bearer token.
6. Poll `GET /orders/ORDER_ID` until the state is `paid`.

The fake-payment completion is asynchronous and is handled by the BullMQ processor in the API process. Orders are stored in PostgreSQL; Redis backs queues and rate limits.

## Public-demo security notes

- The seeded credentials are intentionally public and must never be reused. Set `RUN_SEED=false` if the demo account is not needed, and keep the service isolated from sensitive data.
- Use unique secrets, keep `deploy/.env` private, and never put credentials in the image, source control, build arguments, screenshots, or shared logs. The image has no embedded runtime secrets.
- Public registration/login and API endpoints are rate-limited, but the service is not intended for sensitive or production workloads. Restrict exposure, monitor resource use, and rotate secrets if they are disclosed.
- Do not expose PostgreSQL or Redis to the internet. Use a firewall and TLS reverse proxy, and configure trusted proxy hops accurately.
- Back up PostgreSQL volumes. The Compose Redis instance uses AOF persistence for queues, but it is not a substitute for database backups.

Stop without deleting data with `docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml down`. Add `-v` only when intentionally deleting database and Redis volumes.

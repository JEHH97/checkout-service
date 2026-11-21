# Free demo deployment: Neon + Render

This guide deploys the fake-payment demo. It creates one Render Free web service (`checkout-api`); the BullMQ processor runs in the API process. It does not create its own Key Value instance: it reuses the one owned by `go-shortener`. No separate worker, Render PostgreSQL service, or Stripe account is needed. The hosted URL stays out of the README until the owner deploys it.

Render allows only **one free Key Value instance per workspace**. Deploy `go-shortener` first; it creates the shared `go-shortener-redis` instance. This service then points `REDIS_URL` at that instance using database index `/1`, while go-shortener keeps the default index `0`.

## 1. Create the Neon database

1. Sign in to Neon and create a project named `checkout-service`.
2. Select a region close to the Render region you plan to use and the default supported PostgreSQL version.
3. Use the default database and role, or create a database named `checkout` and a dedicated role for this service. Save the role password securely.
4. In the Neon connection details, select the `checkout` database and copy its connection string. A direct connection is suitable for the single free web instance. Keep the connection string private; it contains the database password.
5. Confirm the URL uses `postgresql://` and has TLS enabled, for example the form `postgresql://<role>:<password>@<host>/<database>?sslmode=require`. Keep the actual username, password, and host from your own Neon project; do not copy this example literally.

The container applies the Prisma schema at startup with `prisma db push`. Do not create a second Render database; the blueprint intentionally asks you to provide the Neon `DATABASE_URL`.

## 2. Create the Render services

1. Deploy `go-shortener` first, following its `DEPLOY.md`. This creates the Key Value instance `go-shortener-redis`, which this service shares.
2. Confirm `checkout-service` will be deployed in the **same Render workspace and the same region** as `go-shortener`. Internal Key Value URLs only resolve inside the same workspace and region.
3. In Render, choose **New → Blueprint** and connect this repository. Select the repository root so Render reads `render.yaml`.
4. The blueprint defines one service, `checkout-api`: **Web Service**, Docker runtime, **Free** plan, health check path `/health/live`. It does **not** create a Key Value instance.
5. When prompted for `DATABASE_URL`, paste the connection string from your Neon project. Keep the value private.
6. When prompted for `REDIS_URL`, set it manually. Do not leave it blank:
   1. In Render, open the `go-shortener-redis` Key Value instance and select **Connect → Internal**. Copy the **Internal Key Value URL**, for example `redis://red-xxxx:6379`.
   2. Append `/1` to the end, for example `redis://red-xxxx:6379/1`.
   3. Paste that value into `REDIS_URL` for `checkout-api`.
7. Apply the blueprint. Render generates `JWT_SECRET`.
8. In the `checkout-api` environment settings, verify these exact values are present:

   | Key               | Value / source                                                                      |
   | ----------------- | ----------------------------------------------------------------------------------- |
   | `NODE_ENV`        | `production`                                                                        |
   | `DATABASE_URL`    | Neon connection string, entered as a non-synchronized value                         |
   | `REDIS_URL`       | Internal Key Value URL of `go-shortener-redis` with `/1` appended, entered manually |
   | `JWT_SECRET`      | Render-generated secret (`generateValue: true`)                                     |
   | `PAYMENT_ADAPTER` | `fake`                                                                              |
   | `DEMO_MODE`       | `true`                                                                              |
   | `RUN_SEED`        | `true`                                                                              |

### Why the Key Value instance is shared

- Render's free plan allows one Key Value instance per workspace. A second blueprint that declares its own instance would fail on deploy.
- Both services use the same instance, separated by database index: go-shortener uses index `0` (default), and checkout-service uses index `/1`. The application keys are prefixed and the BullMQ queue uses its own keys, so they do not collide.
- The free Key Value instance is **in-memory only** with a **25 MB** limit. A restart or redeploy of the instance empties its queues and rate-limit counters. This is acceptable for the demo. BullMQ jobs are transient, and real order data is not lost because orders live in Neon PostgreSQL.
- Do not delete or rename `go-shortener-redis`. Doing so breaks `REDIS_URL` for this service.

  `RUN_SEED=true` runs the idempotent demo seed at each container start. It creates or synchronizes `admin@example.test` / `DemoAdmin2026!` and the sample products. These credentials are deliberately public and must only be used for this demo.

### Secrets and payment configuration

- The blueprint generates `JWT_SECRET`. If you need to supply it manually instead, generate a fresh value with `openssl rand -hex 32` and enter it only in Render's environment settings.
- `DATABASE_URL` is a sensitive provider-issued connection string from Neon; do not commit it or share it publicly.
- `REDIS_URL` is the internal Key Value URL of `go-shortener-redis` plus `/1`. It is not a secret on its own, but keep it in Render's environment settings and out of source control.
- This demo does **not** require Stripe secrets. Do not configure `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` for this fake-payment deployment. The existing Stripe adapter remains available only when explicitly selected with `PAYMENT_ADAPTER=stripe` in a separately configured deployment.
- For a production deployment, set `DEMO_MODE=false` (or remove it) and do not expose the demo payment trigger. Do not treat the public seed credentials as production credentials.

## 3. Wait for the first deploy

Render builds the Docker image, connects to Neon and the shared Key Value instance, applies the Prisma schema, runs the seed, then starts the API. Check the service logs for a successful startup and visit `https://<your-render-service>.onrender.com/health/live`. The service root `/` redirects to `/docs` (Swagger).

Render Free web services sleep after 15 minutes without traffic. The first request after sleeping can take about **50 seconds** to wake up; allow it to finish and retry once if the initial request times out. This is expected free-tier behavior, not an application failure.

## 4. Verify the demo in Swagger

1. Open `https://<your-render-service>.onrender.com/docs`.
2. Run `POST /auth/login` with `{"email":"admin@example.test","password":"DemoAdmin2026!"}` and copy `accessToken` from the response.
3. Select **Authorize** and paste the token. Use `GET /products` to select a sample product.
4. Run `POST /cart/items` with `{"productId":"desk-lamp","quantity":1}`. Run `POST /orders` with a fresh `Idempotency-Key` header and copy the returned order ID.
5. Run `POST /payments/{orderId}/intents` with a different fresh `Idempotency-Key`. Then run `POST /demo/orders/{orderId}/pay` to enqueue the simulated successful-payment event.
6. Poll `GET /orders/{orderId}`. The response should show `state: "paid"`. The order and payment endpoints require the same bearer token.

The demo trigger returns `404` unless both `DEMO_MODE=true` and `PAYMENT_ADAPTER=fake` are set. It validates that the order has an initiated payment and is awaiting payment, and sends the event through the same BullMQ processor running in the API process.

## 5. Updating or troubleshooting

- To initialize the demo data manually in a local environment, run `npm run seed` after configuring `DATABASE_URL`. The seed upserts the demo user and sample products and can be safely repeated.
- If `/health/live` fails, check Render logs and confirm that `DATABASE_URL` is the Neon string and `REDIS_URL` is the internal URL of `go-shortener-redis` ending in `/1`. Also confirm both services are in the same workspace and region.
- If the Key Value instance was deleted or recreated, its internal URL can change. Update `REDIS_URL` with the new internal URL plus `/1`, then redeploy.
- If checkout requests return `401`, log in again and re-apply the new bearer token in Swagger. If the demo payment trigger returns `404`, confirm the demo environment flags above.
- Never paste database or JWT secrets into issues, source files, or public screenshots.

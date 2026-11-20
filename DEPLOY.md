# Deployment notes

`render.yaml` describes the API web service, background worker, managed PostgreSQL, and Redis. Configure `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `PAYMENT_ADAPTER=stripe` through the platform's secret manager. Never commit deployment values.

## Stripe test-mode webhook

1. Use Stripe test mode keys from your own test account.
2. Start the API locally or use a secure staging URL.
3. Install Stripe CLI and run `stripe listen --forward-to localhost:3001/webhooks/stripe`.
4. Copy the listener's generated signing secret into `STRIPE_WEBHOOK_SECRET` for that local session.
5. Create a test PaymentIntent and trigger `payment_intent.succeeded`; inspect the API response, worker logs, and order state.
6. Rotate the test webhook secret after the session. This sample intentionally makes no live-mode claims.

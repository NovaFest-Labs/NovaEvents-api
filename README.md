# NovaEvents API

Off-chain API for NovaEvents — handles indexing, notifications, and media for the Stellar event platform.

The smart contract is the source of truth for all on-chain state. This API layers on top of it to provide faster queries, event-driven notifications, and services that can't run on-chain.

## Setup

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev
```

Server starts on `http://localhost:3001`.

## Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/events` | List all events |
| `GET` | `/api/events/:id` | Get event by ID |
| `GET` | `/api/events/:id/tiers` | Get ticket tiers for an event |
| `GET` | `/api/events/:id/sponsorships` | Get all sponsorships for an event |
| `GET` | `/api/events/:id/tickets/:ticketId` | Get ticket by ID |
| `POST` | `/api/events/:id/image` | Upload a cover image for an event |

All write operations (buy ticket, sponsor, create event) happen directly on-chain through the contract — not through this API.

## Rate Limiting

Rate limits are applied per IP address using [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit).

| Scope | Limit | Window |
|-------|-------|--------|
| Global (all routes) | 100 requests | 15 minutes |
| `GET /api/events` | 20 requests | 15 minutes |

`GET /api/events` has a stricter limit because each request fans out one Soroban RPC simulation per event (N+1 pattern), meaning a handful of unthrottled calls can generate significant RPC load.

When a limit is exceeded the API responds with **HTTP 429** and a JSON body:

```json
{ "error": "Too many requests, please try again later." }
```

Standard `RateLimit-*` response headers (RFC 9110 draft-8) are included on every response so clients can track their remaining quota.

## Image Upload

`POST /api/events/:id/image` accepts a `multipart/form-data` body with a single `image` field and stores the file in an S3-compatible object store, returning the public URL.

### Accepted files

| Constraint | Value |
|------------|-------|
| MIME types | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Max size | 5 MB |

### Response

```json
{ "url": "https://novaevents-images.s3.us-east-1.amazonaws.com/events/42/cover-a3f9c1b2.jpg" }
```

On error the API returns an appropriate HTTP status and a `{ "error": "..." }` body:

| Scenario | Status |
|----------|--------|
| No file in request | 400 |
| Wrong MIME type | 400 |
| File exceeds 5 MB | 400 |
| Invalid event ID | 400 |
| S3 / storage failure | 500 |

### Object storage configuration

The endpoint works with any S3-compatible provider. Set the following environment variables (see `.env.example` for annotated examples):

| Variable | Required | Description |
|----------|----------|-------------|
| `S3_BUCKET_NAME` | Yes | Bucket that images are uploaded to |
| `S3_ACCESS_KEY_ID` | Yes | Access key / key ID |
| `S3_SECRET_ACCESS_KEY` | Yes | Secret access key |
| `S3_REGION` | No | Bucket region (default: `auto`) |
| `S3_ENDPOINT` | No | Custom endpoint URL for non-AWS providers (R2, MinIO, etc.) |

**AWS S3** — leave `S3_ENDPOINT` unset. Set `S3_REGION` to your bucket region.

**Cloudflare R2** — set `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` and `S3_REGION=auto`.

**MinIO (local dev)** — set `S3_ENDPOINT=http://localhost:9000` and `S3_REGION=us-east-1`.

Images are stored under the key `events/<eventId>/cover-<random>.ext` so each upload is collision-resistant and the event they belong to is clear from the path.

> **Note:** The image URL is returned from the upload response. Persisting the URL against the event record (so it can be read back later) is tracked in the DB-indexing scope — see the [Issues](https://github.com/NovaFest-Labs/NovaEvents-api/issues) tab.

## Open for contributors

- Index events into a local database for fast listing
- Email / push notifications for ticket purchases and event updates
- Image upload endpoint for event media (S3 or similar)

See the [Issues](https://github.com/NovaFest-Labs/NovaEvents-api/issues) tab for scoped tasks.

## Related repos

- [NovaEvents contract](https://github.com/NovaFest-Labs/NovaEvents) — Soroban smart contract (Rust)
- [NovaEvents App](https://github.com/NovaFest-Labs/NovaEvents-app) — frontend (Next.js)

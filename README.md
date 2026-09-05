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
| `GET` | `/api/admin` | Get the contract admin address |
| `GET` | `/api/events` | List all events |
| `GET` | `/api/events/:id` | Get event by ID |
| `GET` | `/api/events/:id/organizer` | Get organizer address for an event |
| `GET` | `/api/events/:id/status` | Get an event's status (Active/Ended/Cancelled) |
| `GET` | `/api/events/:id/tiers` | Get ticket tiers for an event |
| `GET` | `/api/events/:id/ticket-count` | Get the total number of tickets sold for an event |
| `GET` | `/api/events/:id/sponsorships` | Get all sponsorships for an event |
| `GET` | `/api/events/:id/payouts` | Get all payouts disbursed for an event |
| `GET` | `/api/events/:id/sponsors/:address/share` | Get a sponsor's share of an event's total sponsorship, in basis points |
| `GET` | `/api/events/:id/tickets/:ticketId` | Get ticket by ID |
| `POST` | `/api/events/:id/tickets/:ticketId/notify` | Send a ticket-purchase confirmation email |
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

## Notifications

`POST /api/events/:id/tickets/:ticketId/notify` sends a ticket-purchase confirmation email via [Resend](https://resend.com).

**Trigger mechanism:** an explicit endpoint the client calls right after its on-chain purchase transaction confirms, rather than a poller watching on-chain events. The client already knows the exact moment of success — it submitted and awaited the transaction — so polling would just be a slower, more complex way of learning something the caller already knows. This also keeps the first pass simple; a polling/indexer-based trigger (e.g. to also notify sponsors or catch purchases made outside this API) can be layered on later without changing this endpoint's contract.

### Request

```
POST /api/events/:id/tickets/:ticketId/notify
Content-Type: application/json

{ "email": "buyer@example.com" }
```

### Response

The ticket is looked up on-chain first (a 404 if it doesn't exist is a real client error). Once found, the endpoint **always responds 202** — email delivery is best-effort and failing to send must never surface as an error for the on-chain purchase it's confirming:

```json
{ "delivered": true }
```

```json
{ "delivered": false, "error": "Resend API request failed (422): ..." }
```

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | Yes | API key from your Resend account |
| `EMAIL_FROM_ADDRESS` | Yes | Verified sender, e.g. `NovaEvents <notifications@yourdomain.com>` |

Only ticket-purchase confirmation is wired up in this first pass; event-update notifications to attendees and a push-notification channel are natural follow-ups on top of the same `sendEmail` helper (`src/lib/email.ts`).

## Image Upload

`POST /api/events/:id/image` accepts a `multipart/form-data` body with a single `image` field and stores the file in an S3-compatible object store, returning the public URL.

### Organizer authorization

Image upload is an off-chain write (images can't live on-chain), but it must still be scoped to the event's actual organizer. The caller proves control of the organizer's Stellar wallet with a signed challenge, sent as request headers rather than in the body so it works alongside `multipart/form-data`:

| Header | Description |
|--------|-------------|
| `x-organizer-address` | The organizer's Stellar public key (`G...`) |
| `x-organizer-timestamp` | `Date.now()` in ms when the signature was created |
| `x-organizer-signature` | base64 ed25519 signature (via the organizer's `Keypair`) of the string `novaevents:upload-image:<eventId>:<timestamp>` |

The server:

1. Looks up the event's on-chain organizer via `get_event` and rejects if `x-organizer-address` doesn't match it.
2. Rebuilds the challenge string from the URL's event ID and the supplied timestamp, and verifies the signature against `x-organizer-address`.
3. Rejects timestamps more than 5 minutes old or in the future, so a captured header can't be replayed indefinitely.

This requires no new on-chain call beyond the existing `get_event` read, and reuses the wallet the organizer already holds — no separate credential to issue or store.

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
| Missing/expired/invalid organizer signature | 401 |
| Signer is not the event's organizer | 403 |
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

### Reading the image back

The uploaded URL is persisted to a lightweight local JSON store (`data/event-images.json`) keyed by event ID, so it can be read back later without re-uploading:

- `GET /api/events/:id` and `GET /api/events` include an `image_url` field once an image has been uploaded for that event (the field is omitted, not `null`, when none has been uploaded).
- Re-uploading for the same event **replaces** the URL returned by the API. The previous S3 object is intentionally left in place rather than deleted — cleaning up orphaned objects is left as a follow-up (e.g. a periodic sweep job) rather than done inline on upload.

## Open for contributors

- Index events into a local database for fast listing
- Email / push notifications for ticket purchases and event updates
- Image upload endpoint for event media (S3 or similar)

See the [Issues](https://github.com/NovaFest-Labs/NovaEvents-api/issues) tab for scoped tasks.

## Related repos

- [NovaEvents contract](https://github.com/NovaFest-Labs/NovaEvents) — Soroban smart contract (Rust)
- [NovaEvents App](https://github.com/NovaFest-Labs/NovaEvents-app) — frontend (Next.js)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

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

All write operations (buy ticket, sponsor, create event) happen directly on-chain through the contract — not through this API.

## Open for contributors

- Integrate `@stellar/stellar-sdk` to query the contract
- Index events into a local database for fast listing
- Email / push notifications for ticket purchases and event updates
- Image upload endpoint for event media (S3 or similar)

See the [Issues](https://github.com/OlaGreat/NovaEvents-api/issues) tab for scoped tasks.

## Related repos

- [NovaEvents contract](https://github.com/OlaGreat/NovaEvents) — Soroban smart contract (Rust)
- [NovaEvents App](https://github.com/OlaGreat/NovaEvents-app) — frontend (Next.js)

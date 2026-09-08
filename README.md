
# NovaEvents API

Off-chain API for NovaEvents — notifications, indexing, and media for the Stellar event ticketing platform.

## API Documentation

The full API is documented as an OpenAPI 3.0 spec in [`openapi.yaml`](./openapi.yaml).

When the server is running, an interactive Swagger UI is served at:

```
GET /api/docs
```

e.g. [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

### Endpoints at a glance

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check (RPC reachability, uptime) |
| `GET` | `/api/admin` | Admin / operator info |
| `GET` | `/api/events` | List all events (from local index) |
| `GET` | `/api/events/:id` | Get a single event (live RPC) |
| `GET` | `/api/events/:id/organizer` | Get event organizer |
| `GET` | `/api/events/:id/status` | Get event status |
| `GET` | `/api/events/:id/tiers` | Get ticket tiers |
| `GET` | `/api/events/:id/ticket-count` | Get total ticket count |
| `GET` | `/api/events/:id/sponsorships` | Get sponsorships |
| `GET` | `/api/events/:id/payouts` | Get sponsor payouts |
| `GET` | `/api/events/:id/sponsors/:address/share` | Get a sponsor's revenue share |
| `GET` | `/api/events/:id/tickets/:ticketId` | Get a ticket |
| `POST` | `/api/events/:id/tickets/:ticketId/notify` | Send ticket purchase confirmation email |
| `POST` | `/api/events/:id/image` | Upload event cover image (organizer auth required) |
| `GET` | `/api/docs` | Swagger UI (interactive API docs) |

---

## Indexing and cached events

To avoid the N+1 RPC fan-out on every `GET /api/events` request, the API maintains a lightweight local SQLite index of events and their ticket tiers.

- DB: a local SQLite file (default `./data/index.db`) is created automatically.
- Indexer: a background process polls the on-chain contract and writes a JSON payload per event into the index.
- Default staleness window: the index is refreshed every 30 seconds (configurable with `INDEX_SYNC_INTERVAL_MS`). In steady state the listing returned by `GET /api/events` can be up to ~30s behind on-chain state.
- Startup: the indexer is enabled by default; set `INDEXER_DISABLED=1` to disable it.
- Endpoint behavior: `GET /api/events` reads from the index (fast, avoids N+1 RPCs). Individual read endpoints such as `GET /api/events/:id` remain live and query the contract directly for freshest data.

Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `INDEX_DB_PATH` | `./data/index.db` | File path for the SQLite index database |
| `INDEX_SYNC_INTERVAL_MS` | `30000` | Poll interval for the background indexer, in milliseconds |
| `INDEXER_DISABLED` | unset | Set to `1` or `true` to disable the indexer on startup |

Rationale

Storing a JSON snapshot per event keeps the implementation lightweight and easy to operate locally (no external DB). It avoids repeated RPC fan-out for list endpoints while still allowing single-item reads to be as fresh as possible.

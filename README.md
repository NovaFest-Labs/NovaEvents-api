
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

## Docker

The repo ships with a multi-stage `Dockerfile` that produces a slim production image.

### Build the image

```bash
docker build -t novaevents-api .
```

### Run the container

Copy `.env.example` to `.env`, fill in your values, then:

```bash
docker run --rm \
  --env-file .env \
  -p 3001:3001 \
  novaevents-api
```

The API will be available at [http://localhost:3001](http://localhost:3001).

To persist the SQLite index across container restarts, mount a volume for the
`data/` directory:

```bash
docker run --rm \
  --env-file .env \
  -p 3001:3001 \
  -v "$(pwd)/data:/app/data" \
  novaevents-api
```

### Required environment variables

| Variable | Description |
|----------|-------------|
| `STELLAR_RPC_URL` | Soroban RPC endpoint (e.g. `https://soroban-testnet.stellar.org`) |
| `NOVA_EVENTS_CONTRACT_ID` | NovaEvents contract address on Stellar |

### Optional environment variables

See [`.env.example`](./.env.example) for the full list of optional variables
(S3 credentials, email settings, indexer tuning, etc.).

> **Never pass secrets via `docker build --build-arg`** — use `--env-file` or
> your orchestrator's secrets manager at runtime.

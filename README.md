# MCP Cartographer

Interactive MCP introspection, mapping, and readiness-audit application.

## Quick start

```bash
pnpm install
# Terminal 1 — API proxy (reads .env for dev MCP credentials)
pnpm dev:api
# Terminal 2 — Vue app
pnpm dev:web
```

Or run both: `pnpm dev`

Open [http://localhost:5173](http://localhost:5173), click **Connect**, then **Connect & Scan**.

Copy `.env.example` to `.env` and fill in `MCP_DEV_*` values for the Klai dev endpoint.

## What's included

**Phase 1**
- Sample scan fixture and import `scan.json`
- Vue Flow map, inspector, audit findings, report export

**Phase 2**
- Local Fastify API proxy for remote MCP
- Streamable HTTP + SSE fallback via `@modelcontextprotocol/sdk`
- Ephemeral credentials (memory only, never localStorage)

## Monorepo layout

```
apps/web/              Vue frontend
apps/api/              Fastify MCP proxy API
packages/shared/       Shared TypeScript types
packages/scan-core/    Scan normalization, findings, export
packages/mcp-client/   MCP SDK wrapper
```

## Next phases

- **Phase 3:** Inspector probe mode
- **Phase 5:** OpenAI Responses API for analyzer + chat tray
- **Phase 6:** Local HTTP MCP, import CLI, stdio bridge

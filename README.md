# MCP Cartographer

**Map, inspect, and audit Model Context Protocol (MCP) servers for AI-agent readiness.**

MCP Cartographer discovers tools, resources, and prompts from a live MCP endpoint, builds an interactive graph, and scores how well an AI agent can *use* the server.

![MCP Cartographer map view](docs/mcp-cartographer-map.png)

## User guide

End-user documentation lives in **[docs/user-guide/](docs/user-guide/)** — the same Markdown files power the in-app **Help** modal. Edit there only; do not duplicate usage, scoring, or troubleshooting content in this README.

## Development

```bash
pnpm install
pnpm dev          # API (3333) + web (5173)
# or: pnpm dev:api && pnpm dev:web
```

Open [http://localhost:5173](http://localhost:5173). Copy `.env.example` to `.env` for `MCP_DEV_*` dev connection defaults.

### Monorepo layout

```
apps/web/              Vue 3 + Vite + Tailwind frontend
apps/api/              Fastify MCP proxy API
packages/shared/       Shared TypeScript types
packages/scan-core/    Scan normalization, graph, findings, export
packages/mcp-client/   MCP SDK connection wrapper
docs/user-guide/       Product docs (in-app Help source)
```

### Tech stack

Vue 3, Vite, Tailwind, Vue Flow, Pinia, Fastify, `@modelcontextprotocol/sdk`, pnpm workspaces, TypeScript.

## Deploy on Vercel

One Vercel project at the **repository root** — static web + API serverless function on the same domain (`/api/*`).

1. Import `DelfsEngineering/MCP-Cartographer` on Vercel.
2. **Root Directory:** leave as `.` (repo root).
3. **Framework:** Vite (settings come from root `vercel.json`).
4. Deploy — no extra env vars required for the default setup.

Local dev is unchanged: `pnpm dev` proxies `/api` to port 3333.

## License

See repository for license details.

Built by [Delfs' Engineering](https://github.com/DelfsEngineering).

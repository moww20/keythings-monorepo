# Keythings Wallet Documentation Site

This repository contains the marketing and product documentation site for **Keythings Wallet**, a secure non-custodial browser extension for the Keeta Network. The site is built with Next.js 15, TypeScript, and Tailwind CSS 4, and it delivers an interactive reading experience with a persistent sidebar, contextual table of contents, breadcrumbs, search entry point, and light/dark theming.

## Features

- **Next.js App Router** with route-level metadata, redirects, and streaming layout.
- **Responsive docs shell** featuring breadcrumbs, previous/next navigation, and a sticky table of contents.
- **Animated global navigation bar** with theme toggle, external community links, and a global search trigger.
- **Tailwind CSS 4 design system** enhanced by custom CSS tokens defined in `src/app/globals.css`.
- **Full TypeScript typings** for components, hooks, and context, including shared Keeta SDK types in `src/types`.
- **React component–driven documentation pages** that allow rich JSX layouts instead of static Markdown.

## Prerequisites

- [Bun](https://bun.sh) 1.1+ (recommended for faster installs and script execution)
- Node.js 20 or later (18+ should work, but 20 LTS is recommended for Next.js 15)

## Development Workflow

This project uses **RAG (Retrieval-Augmented Generation)** with the **Keeta SDK documentation** to ensure correct implementation patterns, and all source files are authored in TypeScript for improved safety and IDE support:

- 📚 **[RAG Development Guide](./RAG_DEVELOPMENT_GUIDE.md)** - Complete guide to RAG-powered development
- 🔍 **[RAG Quick Reference](./RAG_QUICK_REFERENCE.md)** - Quick reference for common queries
- 📊 **[RAG Example](./RAG_EXAMPLE_BALANCE_TRACKING.md)** - Real-world implementation example
- ⚙️ **[AGENTS.md](./AGENTS.md)** - Complete agent rules and workflow

**Quick Start:**
1. Think about the problem
2. Search Keeta docs via MCP (Model Context Protocol)
3. Implement using official SDK patterns
4. Verify Keeta alignment

## Installation

Install dependencies with Bun:

```bash
bun install
```

## Available scripts

All scripts are defined in `package.json` and can be executed with `bun run <script>`.

| Script | Description |
| --- | --- |
| `dev` | Starts the local development server at `http://localhost:3000` with hot reloading. |
| `build` | Creates an optimized production build of the site and runs TypeScript checks. |
| `start` | Serves the previously built production assets. |
| `lint` | Runs ESLint using the Next.js configuration. |

Example:

```bash
bun run dev
```

## Keythings dApp Engine (Backend)

The backend trading engine is built with Rust and Actix-web, providing high-performance order matching, settlement, and Keeta blockchain integration.

### Running with Docker

All backend services run in Docker containers. Navigate to the `docker/` directory to manage the engine:

```bash
cd docker
```

| Command | Description |
| --- | --- |
| `docker compose up --build -d` | Build and start the engine in detached mode |
| `docker compose down` | Stop and remove the engine container |
| `docker compose restart` | Restart the running engine |
| `docker compose logs -f` | View live logs from the engine |
| `docker compose logs --tail=50` | View last 50 log lines |
| `docker ps` | Check running containers status |

### Backend Configuration

- **Container Name**: `keythings_dapp_engine`
- **Port**: `8080` (exposed on `localhost:8080`)
- **API Base URL**: `http://localhost:8080/api`
- **WebSocket URL**: `ws://localhost:8080/ws/trade`
- **Health Check**: `http://localhost:8080/api/health`

### Available API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check endpoint |
| GET | `/api/auth/challenge/{pubkey}` | Get authentication challenge |
| POST | `/api/auth/session` | Create authentication session |
| GET | `/api/balances/{user_id}` | List user balances |
| POST | `/api/internal/credit` | Credit balance (internal) |
| POST | `/api/orders` | Place a new order |
| DELETE | `/api/orders/{order_id}` | Cancel an order |
| POST | `/api/withdrawals` | Request withdrawal |
| GET | `/api/deposit/{user_id}/{token}` | Get deposit address |

### WebSocket Real-Time Data

The backend exposes a WebSocket endpoint at `ws://localhost:8080/ws/trade` for real-time trading data.

**Subscription Message:**
```json
{
  "type": "subscribe",
  "channels": [
    "orderbook:KTA/USDT",
    "trades:KTA/USDT",
    "orders:USER_PUBLIC_KEY"
  ]
}
```

**Message Types:**
- `orderbook` - Real-time order book updates with bids and asks
- `trade` - New trade execution notifications
- `order_update` - User order status changes

### Backend Architecture

The engine includes:
- **Ledger System** - Account and balance management
- **Trading Engine** - Order matching and execution (16 workers)
- **Settlement Queue** - Transaction settlement processing
- **Reconciler** - Account reconciliation
- **Keeta Client** - Integration with Keeta blockchain RPC
- **WebSocket Server** - Real-time data streaming for trading clients

## Project structure

```
src/
  app/
    layout.tsx          # Global layout, metadata, and navbar
    page.tsx            # Redirects `/` to `/docs`
    globals.css         # Tailwind layer imports and custom design tokens
    components/         # Shared UI (Navbar, SearchBar, ThemeToggle, etc.)
    docs/               # All documentation routes, shell, and supporting components
      DocsShell.tsx     # Wraps doc pages with sidebar, breadcrumbs, and right-hand TOC
      components/       # Breadcrumbs, doc navigation, heading anchors, scroll handling
      toc/              # Sidebar hierarchy (`items.ts`) and rendered TOC components
      [slug]/page.tsx   # Individual documentation sections authored as React components
public/                 # Static assets such as icons and images
```

## Editing documentation content

1. **Create or update a page** by editing the appropriate `page.tsx` file under `src/app/docs/**`. Each page exports optional `metadata` for SEO/canonical URLs and returns JSX (TSX) for the body content.
2. **Update the sidebar and navigation order** in `src/app/docs/toc/items.ts`. The structure defined there powers the left sidebar, breadcrumbs, and previous/next controls.
3. **Use shared components** from `src/app/docs/components` (e.g., `DocNav`, `Breadcrumbs`, `HeadingAnchors`) to keep the reading experience consistent. Type definitions are colocated with each component for better editor hints.
4. **Style rich content** with the `docs-prose` utility class, which provides typography defaults tuned for long-form documentation.

## Theming and styling

Theme tokens and global utilities live in `src/app/globals.css`. The `ThemeToggle` component switches between dark and light modes by toggling the `data-theme` attribute on the root `<html>` element. Tailwind CSS classes can be mixed with the provided custom utilities to keep visuals on brand.

## Deployment

1. Build the production bundle:
   ```bash
   bun run build
   ```
2. Serve the output locally to verify:
   ```bash
   bun run start
   ```
3. Deploy the `.next` production build to your hosting provider (e.g., Vercel, Netlify, or any platform that supports Next.js 15).

## License

A dedicated license file is not currently included. Please consult the project maintainers before reusing or distributing the contents of this repository.

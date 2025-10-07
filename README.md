# Keythings Wallet Documentation Site

This repository contains the marketing and product documentation site for **Keythings Wallet**, a secure non-custodial browser extension for the Keeta Network. The site is built with Next.js 15 and Tailwind CSS 4, and it delivers an interactive reading experience with a persistent sidebar, contextual table of contents, breadcrumbs, search entry point, and light/dark theming.

## Features

- **Next.js App Router** with route-level metadata, redirects, and streaming layout.
- **Responsive docs shell** featuring breadcrumbs, previous/next navigation, and a sticky table of contents.
- **Animated global navigation bar** with theme toggle, external community links, and a global search trigger.
- **Tailwind CSS 4 design system** enhanced by custom CSS tokens defined in `src/app/globals.css`.
- **React component–driven documentation pages** that allow rich JSX layouts instead of static Markdown.

## Prerequisites

- [Bun](https://bun.sh) 1.1+ (recommended for faster installs and script execution)
- Node.js 20 or later (18+ should work, but 20 LTS is recommended for Next.js 15)

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
| `build` | Creates an optimized production build of the site. |
| `start` | Serves the previously built production assets. |
| `lint` | Runs ESLint using the Next.js configuration. |

Example:

```bash
bun run dev
```

## Project structure

```
src/
  app/
    layout.js           # Global layout, metadata, and navbar
    page.js             # Redirects `/` to `/docs`
    globals.css         # Tailwind layer imports and custom design tokens
    components/         # Shared UI (Navbar, SearchBar, ThemeToggle, etc.)
    docs/               # All documentation routes, shell, and supporting components
      DocsShell.js      # Wraps doc pages with sidebar, breadcrumbs, and right-hand TOC
      components/       # Breadcrumbs, doc navigation, heading anchors, scroll handling
      toc/              # Sidebar hierarchy (`items.js`) and rendered TOC components
      [slug]/page.js    # Individual documentation sections authored as React components
public/                 # Static assets such as icons and images
```

## Editing documentation content

1. **Create or update a page** by editing the appropriate `page.js` file under `src/app/docs/**`. Each page exports optional `metadata` for SEO/canonical URLs and returns JSX for the body content.
2. **Update the sidebar and navigation order** in `src/app/docs/toc/items.js`. The structure defined there powers the left sidebar, breadcrumbs, and previous/next controls.
3. **Use shared components** from `src/app/docs/components` (e.g., `DocNav`, `Breadcrumbs`, `HeadingAnchors`) to keep the reading experience consistent.
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

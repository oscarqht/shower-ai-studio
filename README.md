# Shower Studio

![Shower Studio Poster](docs/poster.jpeg)

**Shower Studio** is a web application built with Next.js for composing and generating AI images using character references and style packs synced from Raindrop.io collections.

## Key Features

- 🔄 **Raindrop.io Integration**: Connect via OAuth2 authentication or manual API Bearer token to sync character bookmarks and style packs.
- 👤 **Character Management**: Select multiple characters, add custom character entries, edit tags/covers, or remove items.
- 🎨 **Style Packs**: Browse and apply visual style presets, prompts, and reference images.
- ⚙️ **Generator Controls**: Customize composition prompts, aspect ratios, reference images, and export generation payloads.
- ⚡ **Local Persistence**: Caches settings and collections in local storage for fast loading.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling & UI**: Tailwind CSS, daisyUI, Lucide Icons, Framer Motion
- **APIs**: `@google/genai`, Raindrop.io REST API

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 12.14.0 (pinned in `package.json`)

Install the pinned pnpm version on macOS/Linux with the standalone installer:

```bash
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=12.14.0 sh -
```

Follow the installer's instructions to make `pnpm` available in your shell, then check `pnpm --version` reports `12.14.0`. See the [pnpm installation guide](https://pnpm.io/installation) for Windows setup. The standalone executable works with Node.js 20; installation through npm requires Node.js 22.13 or newer.

### Setup & Installation

1. **Install dependencies**:
   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Configure environment variables**:
   Create a `.env.local` file (refer to `.env.example`):
   ```bash
   cp .env.example .env.local
   ```
   ```env
   RAINDROP_CLIENT_ID="your_client_id"
   RAINDROP_CLIENT_SECRET="your_client_secret"
   ```

3. **Start development server**:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.

### Checks & Production Build

```bash
pnpm lint
pnpm build
pnpm start
```

Commit `pnpm-lock.yaml` when dependencies change. Use `pnpm add <package>` or `pnpm add -D <package>` to add dependencies, and `pnpm install --frozen-lockfile` for reproducible installs in CI and deployment environments.

`pnpm-workspace.yaml` records the install scripts approved for the current dependencies. If a dependency update requires another install script, review it with `pnpm approve-builds` and commit the resulting configuration change.


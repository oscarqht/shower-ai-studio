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

- Node.js 18+ or Bun

### Setup & Installation

1. **Install dependencies**:
   ```bash
   npm install
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
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.


# bwend

**Match on music before you match on looks.**

A music-first dating app where you connect through Spotify taste before seeing faces.

## Quick Start

```bash
npm install
npm run dev
```

## Setup

1. Copy environment variables:
```bash
cp .env.example .env.local
```

2. Add your Spotify Client ID to `.env.local`:
```
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
```

3. Get your Spotify Client ID at: https://developer.spotify.com/dashboard

## Build

```bash
npm run build
```

Output goes to `dist/`, ready to deploy to Vercel.

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS v4

## Project Structure

```
src/
  BwendLandingPage.tsx   # Main landing page component
  App.tsx                # Root component
  index.css              # Tailwind + custom styles
  main.tsx               # Entry point
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SPOTIFY_CLIENT_ID` | Spotify Developer app client ID |
| `VITE_SPOTIFY_REDIRECT_URI` | OAuth redirect URI (default: origin) |

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect your GitHub repo to Vercel for automatic deploys.

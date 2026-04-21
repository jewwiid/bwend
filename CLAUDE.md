# bwend: Claude Code Rules

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4
- **Styling**: CSS custom properties + Tailwind
- **Deploy**: Vercel (static export)

## Design System

### Colors (Mood-Based, Warm)

**Light Mode:**

- Background: `#faf8f5` (warm off-white)
- Background Secondary: `#f5f2ed`
- Text Primary: `#1a1a1a`
- Text Secondary: `#5c5c5c`

**Accent Colors:**

- Peach: `#e8a598`
- Coral: `#d4847c`
- Lavender: `#b8a9c9`
- Warm Yellow: `#e8c97a`
- Blush: `#dba8a8`

**Dark Mode:**

- Background: `#0f0f0f` (soft black)
- Background Secondary: `#1a1a1a`
- Text Primary: `#f5f5f5`
- Text Secondary: `#a0a0a0`

### Typography

- System sans-serif stack (Apple System, Segoe UI, Roboto, Helvetica, Arial)
- Strong scale contrast in headlines
- Generous line-height (1.6)

### Visual Style

- Timeleft warmth + Hinge editorial premium feel
- Soft gradient orbs (not bright/neon)
- Rounded corners (12-16px)
- Minimal, expressive iconography
- Photography should feel: candid, editorial, natural light

## Key Sections

1. **Hero**: "The dating app that sounds like you"
2. **Philosophy**: "We don't match people. We match energy."
3. **How It Works**: 4 cards: Connect → See → Share → Turn into moment
4. **Features**: Your Blend, Vibe Score, Music-first conversation, Date energy
5. **Moods**: "What moves you?" category tags
6. **Comparison**: Bwend vs Traditional apps
7. **Testimonials**: Early beta feedback
8. **Final CTA**: Waitlist signup
9. **Footer**

## Features

### Theme Toggle

- Light/dark mode support
- Toggle button in nav
- Smooth CSS transitions

### Scroll Animations

- Intersection Observer for reveal-on-scroll
- Staggered fade-in transitions
- Floating gradient orb animations

### Waitlist

- Email collection stored in localStorage
- Success state with confirmation

### Spotify Integration

- OAuth connection ready
- Scopes: `user-read-private`, `user-read-email`, `user-top-read`
- For full app (not MVP landing page)

## Architecture

- Single page application
- Component-based structure (Navigation, Hero, Philosophy, HowItWorks, Features, Moods, Comparison, Testimonials, FinalCTA, Footer)
- CSS custom properties for theming
- Dark mode via `.dark` class on `<html>`
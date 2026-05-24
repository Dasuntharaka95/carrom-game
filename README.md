# Carrom Game

A browser-based Carrom board game built with Angular 18 and Matter.js physics engine.

## Features

- **Realistic Physics** — Matter.js-powered collision, friction, and boundary mechanics
- **Single Player vs Bot** — Three difficulty levels (Easy, Medium, Hard)
- **Authentic Board** — Canvas-rendered board with traditional markings and pockets
- **Intuitive Controls** — Slingshot-style drag-to-aim with visual power indicator
- **Scoring System** — Pocket your coins for points; the queen is worth 3!
- **Turn System** — Bonus turns for successful shots, fouls for pocketing the striker
- **Touch Support** — Works on mobile and tablet devices

## How to Play

1. **Place the Striker** — Click on the highlighted baseline to position your striker
2. **Aim & Shoot** — Click the striker, then drag away from your target direction (slingshot style). The further you drag, the harder the shot.
3. **Score Points** — Pocket your white coins (+1 each). The red queen is worth +3 points.
4. **Win** — The game ends when all coins of one color are pocketed. Highest score wins!

## Tech Stack

- **Angular 18** — Component framework
- **Matter.js** — 2D physics engine (collisions, friction, restitution)
- **HTML5 Canvas** — Game rendering
- **TypeScript** — Type-safe game logic
- **SCSS** — Styling

## Development

```bash
npm install
npm start          # http://localhost:4200
npm run build      # Production build
```

## Deployment

The game auto-deploys to GitHub Pages via the included GitHub Actions workflow on push to `main`.

**Live:** [https://dasuntharaka95.github.io/carrom-game/](https://dasuntharaka95.github.io/carrom-game/)

## Project Structure

```
src/app/
├── models/
│   └── game.models.ts         # Interfaces, enums, constants
├── services/
│   ├── physics.service.ts     # Matter.js physics wrapper
│   ├── bot.service.ts         # Bot AI (Easy/Medium/Hard)
│   └── game-engine.service.ts # Game state, rules, scoring
├── components/
│   ├── board/                 # Canvas board + input handling
│   └── menu/                  # Game mode selection screen
└── app.component.ts           # Root component
```

## Bot AI

| Level  | Strategy |
|--------|----------|
| Easy   | Random shots aimed at own coins |
| Medium | Calculates coin-to-pocket angles for best shot |
| Hard   | Multi-position evaluation, path blocking detection, strategic play |

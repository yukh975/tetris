# Tetris

Classic Tetris game in a single HTML file. No dependencies, no build step — just open `index.html` in a browser.

## Features

- **15 x 25 grid** with 3D beveled block rendering
- **All 7 tetrominoes** (I, O, T, S, Z, J, L) with SRS wall kick rotation
- **Animated hard drop** — piece slides down smoothly, no cancelling
- **Progressive difficulty** — speed increases with each level
- **Score tracking** — last score and best score saved to localStorage
- **Dark theme** UI with score, level, lines, and next piece preview
- **Mobile touch controls** on small screens

## Controls

| Key | Action |
|-----|--------|
| `←` `→` | Move left / right |
| `↑` | Rotate |
| `↓` | Soft drop (1 cell) |
| `Space` | Hard drop (animated) |
| `P` / `Esc` | Pause |

## Scoring

| Action | Points |
|--------|--------|
| Soft drop | 1 per cell |
| Hard drop | 2 per cell |
| 1 line | 100 x level |
| 2 lines | 300 x level |
| 3 lines | 500 x level |
| 4 lines (Tetris) | 800 x level |

Level increases every 10 cleared lines.

# Flex Time Killer

A mobile-first 2D fighting game built as a browser game, presented inside a Zebra (Donkey) device frame with Game Boy-style virtual controls.

## Quick Start

Since this project uses ES modules, you need a local web server (can't just open index.html directly).

### Option 1 — Python (easiest)
```bash
cd Flex Time Killer
python3 -m http.server 8000
```
Then open `http://localhost:8000` on your phone or browser.

### Option 2 — Node.js
```bash
npx serve .
```

### Option 3 — VS Code
Install the "Live Server" extension, right-click `index.html` → "Open with Live Server".

### Testing on your phone
Run the server on your computer, then open `http://<your-local-ip>:8000` on your phone (both devices must be on the same WiFi network).

## Controls

### Desktop (Keyboard)
| Action | Key |
|--------|-----|
| Move Left | A |
| Move Right | D |
| Jump | W |
| Block | S |
| Quick Attack | J |
| Heavy Attack | K |
| Start/Pause | Enter |
| Select/Back | Escape |

### Mobile (Touch)
D-pad on the left, A/B buttons on the right, Start/Select at the bottom.

## Project Structure
```
warehouse-warriors/
├── index.html          ← Entry point
├── css/style.css       ← All styling
├── js/
│   ├── main.js         ← Game loop & state machine
│   ├── player.js       ← Fighter class
│   ├── ai.js           ← AI opponent
│   ├── renderer.js     ← Canvas drawing
│   ├── controls.js     ← Input handling
│   └── constants.js    ← All tunable values
└── assets/
    ├── zebra-frame.png ← Device frame (cropped, transparent)
    └── background.jpg  ← Warehouse background
```

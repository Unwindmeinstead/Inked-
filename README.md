# Inked+

Notes app with notebooks, rich editor, AI suggestions (Groq), and voice-to-text.

## Running the code

Run `npm i` to install dependencies, then `npm run dev` to start the dev server.

## Mac desktop app (Electron)

- **Dev:** `npm run electron:dev` — builds the Inked+ icon, starts Vite, then opens the Electron window (with the Inked+ logo in the dock and window).
- **Package:** `npm run electron:build` — builds the app and outputs a Mac `.dmg` and `.zip` in `release/`. The app uses the Inked+ logo from `public/inked-icon.svg` (generated to `build/icon.png` for the dock and installer).

## Swift / Mac

See the **Inked+** folder for the SwiftUI Mac app. Open **Inked+/InkedPlus.xcodeproj** in Xcode and press **⌘R** to run.
  
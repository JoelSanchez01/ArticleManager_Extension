// src/background/background.ts
// Entry point for the background service worker.
// All logic lives in index.ts — this file exists to give @crxjs/vite-plugin
// a uniquely-named bundle so it doesn't collide with src/content/index.ts.
import './index.ts'

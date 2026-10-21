---
"@adraw/react": minor
---

Add `onReady`, `initialDocument`/`initialElements` and `useCanvasEngine()`. The provider now creates the headless engine synchronously and only mounts it in `<Canvas>`, so descendants can use the engine without depending on effect order and StrictMode no longer loses state. `setOptions` applies live options without recreating the engine unless constructor-only options change, and recreations preserve the document, viewport and tool styles.

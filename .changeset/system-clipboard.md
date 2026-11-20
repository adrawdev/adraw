---
"@adraw/core": minor
---

Integrate the system clipboard in the DOM adapter. Native `copy`, `cut` and
`paste` events now write and read both `application/x-adraw+json` and a
`text/plain` JSON fallback while the canvas is focused, including across tabs.
Paste prefers the structured payload, validates it through the clipboard parser
and falls back to the in-memory buffer when the browser denies access. The
inline text editor and form fields keep native behavior, and Ctrl/Cmd+C/X/V are
left to the browser while the feature is enabled. Set
`clipboard: { system: false }` to disable the built-in handling and wire the
system clipboard manually.

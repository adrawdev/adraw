---
"@adraw/core": minor
---

Add built-in file drop and clipboard image paste to the DOM adapter. Dropped
image files are centered on the pointer with their aspect ratios preserved,
pasted images use the last pointer position or the viewport center, and multiple
files are inserted as one batch. Files are read as data URLs and
become regular media elements, so history, selection, transforms and documents
work unchanged.

Configure it with `CanvasOptions.media`:

```ts
const canvas = new AdrawCanvas({
  container,
  media: {
    enabled: true,
    accept: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    onRejected: (file, reason, error) => showToast(file.name, reason),
  },
})
```

`accept` defaults to `image/*` and supports exact MIME types and wildcards.
Unsupported, unreadable or undecodable files are ignored; `onRejected` receives
`"unsupported-type"`, `"read-error"` or `"invalid-image"`, and a console warning
is used when no callback is provided. Dropped files and image URLs are prevented
from navigating the page, the inline text editor and form fields keep native
paste behavior, and `enabled: false` disables the feature.

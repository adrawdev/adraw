# @adraw/svelte

## 0.1.4

### Patch Changes

- [`b16b4dd`](https://github.com/adrawdev/adraw/commit/b16b4dd45f0666d35b5016835852a13c2ca5553e) Thanks [@vladiantio](https://github.com/vladiantio)! - Snap elements to other elements' edges and centers while moving, resizing or drawing. Snapping activates while holding Ctrl/Cmd, or by default with the new `isSnapMode` option; alignment guides are rendered while snapped.

  **Breaking:** `snapping.enabled` was removed. Snapping is always available and gated per gesture by Ctrl/Cmd or `isSnapMode`; `SnappingConfig` is now `{ threshold }`.

- Updated dependencies [[`cc2366e`](https://github.com/adrawdev/adraw/commit/cc2366e26731e1aebd2adc6a5b12f4f230e7d142), [`311d282`](https://github.com/adrawdev/adraw/commit/311d2826d46fc125acbaeb5e49e27ee9c221ac09), [`8fdfb7b`](https://github.com/adrawdev/adraw/commit/8fdfb7b2e855d7790e7319ce4f3003aba6e139aa), [`4200c29`](https://github.com/adrawdev/adraw/commit/4200c29efb29e0079a03ec52b848a7c14c0b1f8f), [`b16b4dd`](https://github.com/adrawdev/adraw/commit/b16b4dd45f0666d35b5016835852a13c2ca5553e)]:
  - @adraw/core@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`6d5962e`](https://github.com/adrawdev/adraw/commit/6d5962e5577fe1138a557136e76666f5c78cfcfa), [`ab7567d`](https://github.com/adrawdev/adraw/commit/ab7567d058310627b9fb046ea6804af731ef37c2), [`4b50663`](https://github.com/adrawdev/adraw/commit/4b50663cbfd1f8e71f6e5ff960eb248ea41e426a)]:
  - @adraw/core@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies

  - @adraw/core@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies

  - @adraw/core@0.1.1

- Implement `useTransformOverlay()` hook to manage overlay visibility during transformation gestures

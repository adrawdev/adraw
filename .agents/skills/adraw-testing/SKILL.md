---
name: adraw-testing
description: Run and troubleshoot adraw's unit and Playwright tests. Use this skill whenever the user asks to test, verify, or debug this repository, run browser or E2E tests, install Playwright browsers, diagnose WebKit failures, or prepare changes for submission.
compatibility: Requires pnpm 11.x and the repository dependencies. Native WebKit troubleshooting assumes Arch Linux; distrobox is available as a fallback.
---

# Adraw Testing

Run all commands from the repository root using `pnpm`.

## Unit Tests

```bash
pnpm test           # all unit tests (Vitest, scoped to packages/**)
pnpm test run packages/core/src/__tests__/coordinates.test.ts  # single file
```

## E2E Tests

E2E specs use Playwright and target `examples/vite-vanilla`, which exposes the
canvas instance as `window.adraw`. The Playwright configuration is in
`playwright.config.ts`. It defines desktop projects for Chromium, Firefox, and
WebKit; mobile viewports are intentionally omitted.

Install browsers and dependencies when needed:

```bash
pnpm test:e2e:install             # download browsers (one-time)
pnpm test:e2e:install --with-deps # download browsers + OS deps (one-time)
```

Run the suite or open the Playwright UI:

```bash
pnpm test:e2e
pnpm test:e2e:ui
```

## WebKit on Native Arch Linux

Install the WebKit browser and the system libraries needed by its WPE
MiniBrowser:

```bash
pnpm test:e2e:install webkit
sudo pacman -S flite libxml2-legacy
paru -S flite-voices-extra icu74   # or yay -S ...
```

The package installations require root permissions. WebKit's WPE MiniBrowser
loads Flite voice libraries, so both `flite` and `flite-voices-extra` are
needed. The legacy `icu74` and `libxml2-legacy` packages provide the sonames
expected by the Playwright build. The Playwright download already bundles WPE
WebKit, WPE, JPEG XL, and libbacktrace; do not install system replacements for
those bundled libraries based on a plain `ldd` result.

To diagnose a WebKit launch error, include Playwright's bundled library paths
when checking dependencies. Replace `<version>` with the installed
`webkit-*` directory name:

```bash
WEBKIT_DIR="$HOME/.cache/ms-playwright/webkit-<version>/minibrowser-wpe"
LD_LIBRARY_PATH="$WEBKIT_DIR/lib:$WEBKIT_DIR/sys/lib" \
  ldd "$WEBKIT_DIR/bin/MiniBrowser" | rg "not found"
pacman -F <missing-soname>                  # use `sudo pacman -Fy` first if needed
```

Run one WebKit spec before running the full project:

```bash
pnpm test:e2e -- e2e/edge-resize.spec.ts --project=webkit
pnpm test:e2e -- --project=webkit --reporter=list --workers=2
```

## Distrobox Fallback

On Arch or Fedora, use an Ubuntu distrobox if the native environment cannot
launch Playwright:

```bash
distrobox create --name pw --image ubuntu:24.04   # first time only
distrobox enter pw -- bash -lc \
  'node node_modules/@playwright/test/cli.js test --reporter=list --workers=2'
```

## Troubleshooting

If port `5173` is already in use, stop the existing Vite process on the host
before running the tests:

```bash
pkill -f vite
```

## Submission Checks

Before submitting a change, run `pnpm lint` and `pnpm test`, and update or add
tests for changed code.

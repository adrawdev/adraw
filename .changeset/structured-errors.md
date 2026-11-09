---
"@adraw/core": minor
---

Add `AdrawError` (`code`, `hint`, `details`, `cause`) and `ADRAW_ERROR_CODES` for stable programmatic error handling. Public validation failures across updates, z-order, media, batch, duplicate/nudge/align/distribute and image export now throw `AdrawError` with a documented code instead of plain `TypeError` / `RangeError`.

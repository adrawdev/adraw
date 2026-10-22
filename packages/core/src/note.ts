import { NOTE_FOLD_SIZE, TEXT_LINE_HEIGHT } from "./constants"
import {
  approximateTextMeasurer,
  getTextAnchor,
  type TextLayout,
  type TextMeasurer,
} from "./text"
import type { NoteElement, TextAlign } from "./types"

/**
 * Inner content width of a note, in pixels.
 *
 * @param note Note element.
 * @returns `width - 2 * padding`, clamped to at least 1.
 */
export function getNoteContentWidth(note: NoteElement): number {
  return Math.max(1, note.width - note.padding * 2)
}

/**
 * Lay out a note's text: fixed-width wrapping inside the note's padded
 * content box. Notes always wrap; they never auto-size horizontally.
 *
 * @param note Note element (its current `text` is used).
 * @param measurer Text measurer. Defaults to the approximation.
 * @returns The laid-out text box and wrapped lines.
 */
export function measureNoteText(
  note: NoteElement,
  measurer: TextMeasurer = approximateTextMeasurer,
): TextLayout {
  return measurer(note.text, {
    autoSize: false,
    fontFamily: note.fontFamily,
    fontSize: note.fontSize,
    lineHeight: note.lineHeight,
    maxWidth: getNoteContentWidth(note),
  })
}

/**
 * Height the note needs to fit its current text without clipping.
 *
 * @param note Note element.
 * @param measurer Text measurer. Defaults to the approximation.
 * @returns Required height in pixels, including padding.
 */
export function getNoteMinHeight(
  note: NoteElement,
  measurer: TextMeasurer = approximateTextMeasurer,
): number {
  return measureNoteText(note, measurer).height + note.padding * 2
}

/**
 * Top of a note's text block relative to the note, in pixels. Short text is
 * vertically centered; overflowing text starts below the top padding.
 *
 * @param note Note element.
 * @param layout Laid-out text.
 * @returns Offset from the note's top edge.
 */
export function getNoteTextTop(note: NoteElement, layout: TextLayout): number {
  const contentHeight = Math.max(1, note.height - note.padding * 2)
  return note.padding + Math.max(0, (contentHeight - layout.height) / 2)
}

/**
 * Horizontal alignment of a note's text. Notes center their text by default.
 *
 * @param note Note element.
 * @returns The effective alignment.
 */
export function getNoteTextAlign(note: NoteElement): TextAlign {
  return note.textAlign ?? "center"
}

/**
 * X coordinate of every rendered note line, relative to the note box.
 *
 * @param note Note element.
 * @returns `padding` for left, `width / 2` for center and `width - padding`
 * for right.
 */
export function getNoteTextLineX(note: NoteElement): number {
  const align = getNoteTextAlign(note)
  if (align === "center") {
    return note.width / 2
  }
  if (align === "right") {
    return note.width - note.padding
  }
  return note.padding
}

/**
 * SVG `text-anchor` matching a note's alignment.
 *
 * @param note Note element.
 * @returns `"start"`, `"middle"` or `"end"`.
 */
export function getNoteTextAnchor(
  note: NoteElement,
): "start" | "middle" | "end" {
  return getTextAnchor({ textAlign: getNoteTextAlign(note) })
}

/**
 * Rendered line height of a note, in pixels.
 *
 * @param note Note element.
 * @returns `fontSize * lineHeight`.
 */
export function getNoteLineHeightPx(note: NoteElement): number {
  return note.fontSize * (note.lineHeight ?? TEXT_LINE_HEIGHT)
}

/**
 * Half-leading above the first note line, matching the HTML editor overlay.
 *
 * @param note Note element.
 * @returns Vertical inset in pixels.
 */
export function getNoteTextLeading(note: NoteElement): number {
  return Math.max(0, (getNoteLineHeightPx(note) - note.fontSize) / 2)
}

/**
 * Size of the folded bottom-right corner, in pixels. The fold is never smaller
 * than the note's corner radius, so its outer edge can follow the same rounded
 * corner instead of painting over it. Small notes drop the fold entirely.
 *
 * @param note Note element.
 * @returns Fold size, or `0` when the note is too small for one.
 */
export function getNoteFoldSize(note: NoteElement): number {
  const max = Math.min(note.width * 0.35, note.height * 0.35)
  if (max < 8 || note.cornerRadius > max) {
    return 0
  }
  return Math.min(Math.max(NOTE_FOLD_SIZE, note.cornerRadius), max)
}

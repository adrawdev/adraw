/**
 * Whether a clipboard event target keeps native behavior instead of reaching the
 * canvas: form controls and contenteditable regions.
 *
 * @internal
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true
  }
  return target instanceof HTMLElement && target.isContentEditable
}

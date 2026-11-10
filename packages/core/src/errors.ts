/**
 * Stable machine-readable codes carried by {@link AdrawError}. New codes may be
 * added in minor releases; existing codes do not change meaning.
 *
 * - `not-mounted` — the operation requires a mounted DOM adapter.
 * - `async-callback` — a synchronous callback received a Promise.
 * - `invalid-argument` — an argument has the wrong shape.
 * - `invalid-option` — an option value is invalid.
 * - `immutable-field` — a patch tried to change `id` or `type`.
 * - `derived-field` — a patch tried to change a derived field.
 * - `unknown-field` — a patch contains a field the element type does not own.
 * - `invalid-field-type` — a field or option has the wrong primitive type.
 * - `invalid-field-value` — a field value is out of range or otherwise invalid.
 * - `invalid-reference` — a referenced element is missing, invalid, self-referential or creates a cycle.
 * - `invalid-z-index` — a z-index is not a finite number.
 * - `unknown-alignment` — `align()` received an unknown alignment.
 * - `unknown-axis` — `distribute()` received an unknown axis.
 * - `invalid-document` — a canvas document is malformed or failed validation.
 * - `unsupported-version` — a document version is newer than this package supports.
 * - `migration-missing` — no migration path exists from the document version.
 */
export type AdrawErrorCode =
  | "not-mounted"
  | "async-callback"
  | "invalid-argument"
  | "invalid-option"
  | "immutable-field"
  | "derived-field"
  | "unknown-field"
  | "invalid-field-type"
  | "invalid-field-value"
  | "invalid-reference"
  | "invalid-z-index"
  | "unknown-alignment"
  | "unknown-axis"
  | "invalid-document"
  | "unsupported-version"
  | "migration-missing"

/**
 * Every stable error code currently emitted by adraw. Useful for validation,
 * logging and agent tooling.
 */
export const ADRAW_ERROR_CODES: readonly AdrawErrorCode[] = [
  "not-mounted",
  "async-callback",
  "invalid-argument",
  "invalid-option",
  "immutable-field",
  "derived-field",
  "unknown-field",
  "invalid-field-type",
  "invalid-field-value",
  "invalid-reference",
  "invalid-z-index",
  "unknown-alignment",
  "unknown-axis",
  "invalid-document",
  "unsupported-version",
  "migration-missing",
]

/**
 * Optional metadata attached to an {@link AdrawError}.
 */
export interface AdrawErrorOptions {
  /** Short remediation hint suitable for a developer or agent. */
  hint?: string
  /**
   * Structured context for programmatic handling. Common keys are `field`,
   * `elementType`, `value`, `expected`, `reason`, `elementId` and `option`.
   */
  details?: Record<string, unknown>
  /** Underlying error, if any. */
  cause?: unknown
}

/**
 * The error thrown by adraw's public API for invalid arguments, fields,
 * references and state. Use `code` for stable branching and `hint` for a
 * human-readable remediation.
 *
 * @example
 * ```ts
 * import { AdrawError } from "@adraw/core"
 *
 * try {
 *   canvas.updateElement("rect-1", { width: 0 })
 * } catch (error) {
 *   if (error instanceof AdrawError && error.code === "invalid-field-value") {
 *     console.log(error.hint, error.details)
 *   }
 * }
 * ```
 */
export class AdrawError extends Error {
  /** Stable machine-readable code. */
  readonly code: AdrawErrorCode
  /** Short remediation hint, when one is available. */
  readonly hint?: string
  /** Structured context for programmatic handling. */
  readonly details?: Record<string, unknown>

  constructor(
    code: AdrawErrorCode,
    message: string,
    options: AdrawErrorOptions = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    )
    this.name = "AdrawError"
    this.code = code
    this.hint = options.hint
    this.details = options.details
  }
}

import { isBindableElement } from "./arrow-bindings"
import { AdrawError } from "./errors"
import { isBoundTextContainer } from "./text-bindings"
import type { CanvasDocument, CanvasElement, ElementType } from "./types"

/**
 * Current version of the `CanvasDocument` schema. Documents are migrated to
 * this version before loading.
 */
export const DOCUMENT_VERSION = 1

/**
 * Stable machine-readable code carried by a document validation issue.
 */
export type DocumentIssueCode =
  | "invalid-document"
  | "invalid-version"
  | "unsupported-version"
  | "migration-required"
  | "invalid-element"
  | "duplicate-id"
  | "invalid-value"
  | "dangling-reference"
  | "invalid-reference"
  | "group-cycle"

/**
 * One problem found while validating a serialized canvas document.
 */
export interface DocumentIssue {
  /** JSON-path-like location, for example `elements[2].width`. */
  path: string
  /** Stable code suitable for branching. */
  code: DocumentIssueCode
  /** Human-readable description. */
  message: string
  /** Optional remediation hint. */
  hint?: string
}

/**
 * Result of {@link validateDocument}.
 */
export interface DocumentValidationResult {
  /** `true` when the document has no issues. */
  valid: boolean
  issues: DocumentIssue[]
}

/**
 * One pure document migration step.
 */
export interface DocumentMigration {
  from: number
  to: number
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>
}

const ELEMENT_TYPES = new Set<ElementType>([
  "rectangle",
  "ellipse",
  "diamond",
  "line",
  "arrow",
  "path",
  "media",
  "text",
  "note",
  "group",
])

const TEXT_ALIGNS = new Set(["left", "center", "right"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function push(
  issues: DocumentIssue[],
  path: string,
  code: DocumentIssueCode,
  message: string,
  hint?: string,
): void {
  issues.push({ code, hint, message, path })
}

function checkFiniteNumber(
  value: unknown,
  path: string,
  issues: DocumentIssue[],
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    push(issues, path, "invalid-value", "must be a finite number")
    return false
  }
  return true
}

function checkMin(
  value: unknown,
  path: string,
  min: number,
  issues: DocumentIssue[],
  exclusive = false,
): value is number {
  if (!checkFiniteNumber(value, path, issues)) {
    return false
  }
  if (exclusive ? value <= min : value < min) {
    push(
      issues,
      path,
      "invalid-value",
      `must be ${exclusive ? "greater than" : "at least"} ${min}`,
    )
    return false
  }
  return true
}

function checkString(
  value: unknown,
  path: string,
  issues: DocumentIssue[],
): value is string {
  if (typeof value !== "string") {
    push(issues, path, "invalid-value", "must be a string")
    return false
  }
  return true
}

function checkNonEmptyString(
  value: unknown,
  path: string,
  issues: DocumentIssue[],
): value is string {
  if (!checkString(value, path, issues)) {
    return false
  }
  if (value.length === 0) {
    push(issues, path, "invalid-value", "must not be empty")
    return false
  }
  return true
}

function checkBoolean(
  value: unknown,
  path: string,
  issues: DocumentIssue[],
): value is boolean {
  if (typeof value !== "boolean") {
    push(issues, path, "invalid-value", "must be a boolean")
    return false
  }
  return true
}

function checkEnum(
  value: unknown,
  path: string,
  allowed: Iterable<string>,
  issues: DocumentIssue[],
): boolean {
  if (typeof value !== "string" || !new Set(allowed).has(value)) {
    push(
      issues,
      path,
      "invalid-value",
      `must be one of ${[...allowed].map((entry) => `"${entry}"`).join(", ")}`,
    )
    return false
  }
  return true
}

function checkOptionalString(
  value: unknown,
  path: string,
  issues: DocumentIssue[],
): void {
  if (value !== undefined) {
    checkString(value, path, issues)
  }
}

function checkOptionalNumber(
  value: unknown,
  path: string,
  issues: DocumentIssue[],
  options: {
    exclusiveMin?: boolean
    max?: number
    min?: number
    nullable?: boolean
  } = {},
): void {
  if (value === undefined) {
    return
  }
  if (value === null) {
    if (options.nullable) {
      return
    }
    push(issues, path, "invalid-value", "must be a finite number")
    return
  }
  if (options.min !== undefined) {
    checkMin(value, path, options.min, issues, options.exclusiveMin)
  } else {
    checkFiniteNumber(value, path, issues)
  }
  if (
    typeof value === "number" &&
    options.max !== undefined &&
    value > options.max
  ) {
    push(issues, path, "invalid-value", `must be at most ${options.max}`)
  }
}

function checkOptionalBoolean(
  value: unknown,
  path: string,
  issues: DocumentIssue[],
): void {
  if (value !== undefined) {
    checkBoolean(value, path, issues)
  }
}

function checkOptionalEnum(
  value: unknown,
  path: string,
  allowed: Iterable<string>,
  issues: DocumentIssue[],
): void {
  if (value !== undefined) {
    checkEnum(value, path, allowed, issues)
  }
}

function validateBinding(
  value: unknown,
  path: string,
  issues: DocumentIssue[],
): void {
  if (value === undefined || value === null) {
    return
  }
  if (!isRecord(value)) {
    push(issues, path, "invalid-value", "must be a binding object or null")
    return
  }
  checkNonEmptyString(value.elementId, `${path}.elementId`, issues)
  checkOptionalNumber(value.focus, `${path}.focus`, issues)
}

function validateBaseElement(
  element: Record<string, unknown>,
  path: string,
  issues: DocumentIssue[],
): void {
  checkNonEmptyString(element.id, `${path}.id`, issues)
  if (typeof element.type !== "string") {
    push(issues, `${path}.type`, "invalid-element", "must be a string")
  } else if (!ELEMENT_TYPES.has(element.type as ElementType)) {
    push(
      issues,
      `${path}.type`,
      "invalid-element",
      `unknown element type "${element.type}"`,
    )
  }

  checkFiniteNumber(element.x, `${path}.x`, issues)
  checkFiniteNumber(element.y, `${path}.y`, issues)
  checkMin(element.width, `${path}.width`, 0, issues)
  checkMin(element.height, `${path}.height`, 0, issues)
  checkFiniteNumber(element.rotation, `${path}.rotation`, issues)
  checkFiniteNumber(element.zIndex, `${path}.zIndex`, issues)
  checkBoolean(element.locked, `${path}.locked`, issues)
  checkBoolean(element.visible, `${path}.visible`, issues)
  checkOptionalNumber(element.opacity, `${path}.opacity`, issues, {
    max: 1,
    min: 0,
  })
}

function validateTypeSpecificFields(
  element: Record<string, unknown>,
  type: ElementType,
  path: string,
  issues: DocumentIssue[],
): void {
  switch (type) {
    case "rectangle": {
      checkMin(element.cornerRadius, `${path}.cornerRadius`, 0, issues)
      checkMin(element.strokeWidth, `${path}.strokeWidth`, 0, issues)
      checkString(element.strokeColor, `${path}.strokeColor`, issues)
      checkOptionalString(element.fillColor, `${path}.fillColor`, issues)
      break
    }
    case "ellipse":
    case "diamond": {
      checkMin(element.strokeWidth, `${path}.strokeWidth`, 0, issues)
      checkString(element.strokeColor, `${path}.strokeColor`, issues)
      checkOptionalString(element.fillColor, `${path}.fillColor`, issues)
      break
    }
    case "line":
    case "arrow": {
      checkFiniteNumber(element.startX, `${path}.startX`, issues)
      checkFiniteNumber(element.startY, `${path}.startY`, issues)
      checkFiniteNumber(element.endX, `${path}.endX`, issues)
      checkFiniteNumber(element.endY, `${path}.endY`, issues)
      checkMin(element.strokeWidth, `${path}.strokeWidth`, 0, issues)
      checkString(element.strokeColor, `${path}.strokeColor`, issues)
      if (type === "arrow") {
        checkOptionalBoolean(
          element.startArrowhead,
          `${path}.startArrowhead`,
          issues,
        )
        checkOptionalBoolean(
          element.endArrowhead,
          `${path}.endArrowhead`,
          issues,
        )
        validateBinding(element.startBinding, `${path}.startBinding`, issues)
        validateBinding(element.endBinding, `${path}.endBinding`, issues)
      }
      break
    }
    case "path": {
      const points = element.points
      if (!Array.isArray(points)) {
        push(issues, `${path}.points`, "invalid-value", "must be an array")
      } else {
        if (points.length < 2) {
          push(
            issues,
            `${path}.points`,
            "invalid-value",
            "must contain at least two points",
          )
        }
        for (const [index, point] of points.entries()) {
          const pointPath = `${path}.points[${index}]`
          if (!isRecord(point)) {
            push(
              issues,
              pointPath,
              "invalid-value",
              "must be an { x, y } object",
            )
            continue
          }
          checkFiniteNumber(point.x, `${pointPath}.x`, issues)
          checkFiniteNumber(point.y, `${pointPath}.y`, issues)
        }
      }
      checkMin(element.strokeWidth, `${path}.strokeWidth`, 0, issues)
      checkString(element.strokeColor, `${path}.strokeColor`, issues)
      checkOptionalNumber(element.smoothing, `${path}.smoothing`, issues, {
        max: 1,
        min: 0,
      })
      break
    }
    case "media": {
      checkString(element.src, `${path}.src`, issues)
      checkString(element.mimeType, `${path}.mimeType`, issues)
      checkMin(element.naturalWidth, `${path}.naturalWidth`, 0, issues, true)
      checkMin(element.naturalHeight, `${path}.naturalHeight`, 0, issues, true)
      break
    }
    case "text": {
      checkString(element.text, `${path}.text`, issues)
      checkMin(element.fontSize, `${path}.fontSize`, 0, issues, true)
      checkString(element.strokeColor, `${path}.strokeColor`, issues)
      checkOptionalString(element.fontFamily, `${path}.fontFamily`, issues)
      checkOptionalEnum(
        element.textAlign,
        `${path}.textAlign`,
        TEXT_ALIGNS,
        issues,
      )
      checkOptionalNumber(element.lineHeight, `${path}.lineHeight`, issues, {
        exclusiveMin: true,
        min: 0,
      })
      checkOptionalBoolean(element.autoSize, `${path}.autoSize`, issues)
      if (element.containerId !== undefined) {
        if (element.containerId !== null) {
          checkNonEmptyString(
            element.containerId,
            `${path}.containerId`,
            issues,
          )
        }
      }
      checkOptionalNumber(
        element.labelPosition,
        `${path}.labelPosition`,
        issues,
        {
          max: 1,
          min: 0,
          nullable: true,
        },
      )
      checkOptionalNumber(element.wrapWidth, `${path}.wrapWidth`, issues, {
        exclusiveMin: true,
        min: 0,
        nullable: true,
      })
      break
    }
    case "note": {
      checkString(element.text, `${path}.text`, issues)
      checkMin(element.fontSize, `${path}.fontSize`, 0, issues, true)
      checkString(element.strokeColor, `${path}.strokeColor`, issues)
      checkString(element.fillColor, `${path}.fillColor`, issues)
      checkOptionalString(element.fontFamily, `${path}.fontFamily`, issues)
      checkOptionalEnum(
        element.textAlign,
        `${path}.textAlign`,
        TEXT_ALIGNS,
        issues,
      )
      checkOptionalNumber(element.lineHeight, `${path}.lineHeight`, issues, {
        exclusiveMin: true,
        min: 0,
      })
      checkMin(element.padding, `${path}.padding`, 0, issues)
      checkMin(element.cornerRadius, `${path}.cornerRadius`, 0, issues)
      break
    }
    case "group": {
      const children = element.children
      if (!Array.isArray(children)) {
        push(issues, `${path}.children`, "invalid-value", "must be an array")
      } else {
        if (children.length === 0) {
          push(
            issues,
            `${path}.children`,
            "invalid-value",
            "must contain at least one element id",
          )
        }
        const seen = new Set<string>()
        for (const [index, child] of children.entries()) {
          const childPath = `${path}.children[${index}]`
          if (!checkNonEmptyString(child, childPath, issues)) {
            continue
          }
          if (seen.has(child)) {
            push(
              issues,
              childPath,
              "invalid-value",
              `duplicate child "${child}"`,
            )
          }
          seen.add(child)
        }
      }
      break
    }
  }
}

interface ElementRecord {
  element: Record<string, unknown>
  id: string | null
  index: number
  type: ElementType | null
}

function validateDocumentAt(
  value: unknown,
  expectedVersion: number,
): DocumentValidationResult {
  const issues: DocumentIssue[] = []

  if (!isRecord(value)) {
    push(issues, "$", "invalid-document", "document must be an object")
    return { issues, valid: false }
  }

  const version = value.version
  if (typeof version !== "number" || !Number.isInteger(version)) {
    push(issues, "version", "invalid-version", "must be an integer")
    return { issues, valid: false }
  }
  if (version > expectedVersion) {
    push(
      issues,
      "version",
      "unsupported-version",
      `document version ${version} is newer than the supported version ${expectedVersion}`,
      "Upgrade @adraw/core to read this document.",
    )
    return { issues, valid: false }
  }
  if (version < expectedVersion) {
    push(
      issues,
      "version",
      "migration-required",
      `document version ${version} must be migrated to ${expectedVersion}`,
      "Call migrateDocument(doc) before loading it.",
    )
    return { issues, valid: false }
  }

  const elements = value.elements
  if (!Array.isArray(elements)) {
    push(issues, "elements", "invalid-document", "must be an array")
    return { issues, valid: false }
  }

  const records: ElementRecord[] = []
  const seenIds = new Map<string, number>()
  for (const [index, element] of elements.entries()) {
    const path = `elements[${index}]`
    if (!isRecord(element)) {
      push(issues, path, "invalid-element", "must be an object")
      records.push({ element: {}, id: null, index, type: null })
      continue
    }

    validateBaseElement(element, path, issues)
    const id = typeof element.id === "string" ? element.id : null
    const type =
      typeof element.type === "string" &&
      ELEMENT_TYPES.has(element.type as ElementType)
        ? (element.type as ElementType)
        : null

    if (id && id.length > 0) {
      const first = seenIds.get(id)
      if (first !== undefined) {
        push(
          issues,
          `${path}.id`,
          "duplicate-id",
          `duplicate element id "${id}" (first used by elements[${first}])`,
          "Element ids must be unique.",
        )
      } else {
        seenIds.set(id, index)
      }
    }

    if (type) {
      validateTypeSpecificFields(element, type, path, issues)
    }
    records.push({ element, id, index, type })
  }

  const byId = new Map<string, ElementRecord>()
  for (const record of records) {
    if (record.id && record.type && !byId.has(record.id)) {
      byId.set(record.id, record)
    }
  }

  const parentByChild = new Map<string, string>()
  const groupChildren = new Map<string, string[]>()
  const reportedCycles = new Set<string>()

  for (const record of records) {
    if (record.type === "group" && record.id) {
      const children = record.element.children
      if (!Array.isArray(children)) {
        continue
      }
      const validChildren: string[] = []
      for (const child of children) {
        if (typeof child !== "string") {
          continue
        }
        validChildren.push(child)
        const path = `elements[${record.index}].children`
        if (child === record.id) {
          reportedCycles.add(record.id)
          push(
            issues,
            path,
            "group-cycle",
            `group "${record.id}" cannot contain itself`,
          )
          continue
        }
        const target = byId.get(child)
        if (!target) {
          push(
            issues,
            path,
            "dangling-reference",
            `group "${record.id}" references missing element "${child}"`,
          )
          continue
        }
        const parent = parentByChild.get(child)
        if (parent && parent !== record.id) {
          push(
            issues,
            path,
            "invalid-reference",
            `element "${child}" belongs to both groups "${parent}" and "${record.id}"`,
          )
        } else if (!parent) {
          parentByChild.set(child, record.id)
        }
      }
      groupChildren.set(record.id, validChildren)
    }

    if (record.type === "arrow") {
      for (const field of ["startBinding", "endBinding"] as const) {
        const binding = record.element[field]
        if (!isRecord(binding)) {
          continue
        }
        const targetId = binding.elementId
        if (typeof targetId !== "string" || targetId.length === 0) {
          continue
        }
        const target = byId.get(targetId)
        const path = `elements[${record.index}].${field}`
        if (!target) {
          push(
            issues,
            path,
            "dangling-reference",
            `arrow "${record.id}" binds to missing element "${targetId}"`,
          )
        } else if (
          !isBindableElement(target.element as unknown as CanvasElement)
        ) {
          push(
            issues,
            path,
            "invalid-reference",
            `arrow "${record.id}" binds to "${targetId}", which cannot be a binding target`,
          )
        }
      }
    }

    if (record.type === "text") {
      const containerId = record.element.containerId
      if (typeof containerId === "string" && containerId.length > 0) {
        const target = byId.get(containerId)
        const path = `elements[${record.index}].containerId`
        if (!target) {
          push(
            issues,
            path,
            "dangling-reference",
            `text "${record.id}" is bound to missing container "${containerId}"`,
          )
        } else if (
          !isBoundTextContainer(target.element as unknown as CanvasElement)
        ) {
          push(
            issues,
            path,
            "invalid-reference",
            `text "${record.id}" is bound to "${containerId}", which cannot own bound text`,
          )
        }
      }
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (visited.has(id)) {
      return
    }
    if (visiting.has(id)) {
      const record = byId.get(id)
      if (record && !reportedCycles.has(id)) {
        reportedCycles.add(id)
        push(
          issues,
          `elements[${record.index}].children`,
          "group-cycle",
          `group "${id}" is part of a cycle`,
        )
      }
      return
    }
    visiting.add(id)
    for (const child of groupChildren.get(id) ?? []) {
      if (groupChildren.has(child)) {
        visit(child)
      }
    }
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of groupChildren.keys()) {
    visit(id)
  }

  return { issues, valid: issues.length === 0 }
}

/**
 * Validate a serialized canvas document without mutating it. Returns every
 * issue found instead of throwing, so callers can show them or branch on their
 * stable codes.
 *
 * Checks include the schema version, element shapes and type-specific fields,
 * duplicate ids, dangling group/binding/bound-text references, shared group
 * children and group cycles.
 *
 * @param value Candidate document, usually parsed JSON.
 * @returns Validation result with all issues.
 * @example
 * ```ts
 * const result = validateDocument(JSON.parse(json))
 * if (!result.valid) console.log(result.issues)
 * ```
 */
export function validateDocument(value: unknown): DocumentValidationResult {
  return validateDocumentAt(value, DOCUMENT_VERSION)
}

/** The migration registry for shipped document versions. */
/** @internal */
export const DOCUMENT_MIGRATIONS: readonly DocumentMigration[] = []

/**
 * Migrate a document to a target version using an explicit migration registry.
 * `migrateDocument` uses the built-in registry; this variant is exported for
 * tests and advanced integrations.
 *
 * @internal
 */
export function migrateDocumentWith(
  value: unknown,
  migrations: readonly DocumentMigration[] = DOCUMENT_MIGRATIONS,
  targetVersion: number = DOCUMENT_VERSION,
): CanvasDocument {
  if (!isRecord(value)) {
    throw new AdrawError(
      "invalid-document",
      "migrateDocument: document must be an object",
      {
        details: { reason: "not-an-object" },
        hint: "Parse the document JSON before migrating it.",
      },
    )
  }

  const version = value.version
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new AdrawError(
      "invalid-document",
      "migrateDocument: document version must be an integer",
      {
        details: { reason: "invalid-version", version },
        hint: "Use a document produced by toDocument().",
      },
    )
  }

  if (version > targetVersion) {
    throw new AdrawError(
      "unsupported-version",
      `migrateDocument: document version ${version} is newer than ${targetVersion}`,
      {
        details: { targetVersion, version },
        hint: "Upgrade @adraw/core to read this document.",
      },
    )
  }

  let current: Record<string, unknown> = value
  let currentVersion = version
  const visited = new Set<number>()

  while (currentVersion < targetVersion) {
    if (visited.has(currentVersion)) {
      throw new AdrawError(
        "migration-missing",
        `migrateDocument: no migration path from version ${currentVersion} to ${targetVersion}`,
        {
          details: { from: currentVersion, reason: "cycle", targetVersion },
          hint: "Provide a migration chain that reaches the target version.",
        },
      )
    }
    visited.add(currentVersion)

    const migration = migrations.find((entry) => entry.from === currentVersion)
    if (!migration) {
      throw new AdrawError(
        "migration-missing",
        `migrateDocument: no migration from version ${currentVersion} to ${targetVersion}`,
        {
          details: { from: currentVersion, targetVersion },
          hint: "Provide a migration or load a newer document.",
        },
      )
    }

    let migrated: Record<string, unknown>
    try {
      migrated = migration.migrate(current)
    } catch (error) {
      throw new AdrawError(
        "invalid-document",
        `migrateDocument: migration ${migration.from} -> ${migration.to} failed`,
        {
          cause: error,
          details: { from: migration.from, to: migration.to },
          hint: "Inspect the document and the migration implementation.",
        },
      )
    }

    if (!isRecord(migrated)) {
      throw new AdrawError(
        "invalid-document",
        `migrateDocument: migration ${migration.from} -> ${migration.to} did not return an object`,
        { details: { from: migration.from, to: migration.to } },
      )
    }
    if (migrated.version !== migration.to) {
      throw new AdrawError(
        "invalid-document",
        `migrateDocument: migration ${migration.from} -> ${migration.to} did not set version ${migration.to}`,
        {
          details: {
            actualVersion: migrated.version,
            expectedVersion: migration.to,
          },
        },
      )
    }
    if (migration.to <= currentVersion) {
      throw new AdrawError(
        "invalid-document",
        `migrateDocument: migration ${migration.from} -> ${migration.to} must increase the version`,
        { details: { from: migration.from, to: migration.to } },
      )
    }

    current = migrated
    currentVersion = migration.to
  }

  const result = validateDocumentAt(current, targetVersion)
  if (!result.valid) {
    throw new AdrawError(
      "invalid-document",
      "migrateDocument: migrated document failed validation",
      {
        details: { issues: result.issues },
        hint: "Call validateDocument() to inspect the issues.",
      },
    )
  }

  return current as unknown as CanvasDocument
}

/**
 * Migrate a document to the current schema version.
 *
 * Migrations are pure functions applied in order from the document's version.
 * The migrated document is validated before it is returned.
 *
 * @param value Candidate document, usually parsed JSON.
 * @returns A document at {@link DOCUMENT_VERSION}.
 * @throws {AdrawError} `unsupported-version` for newer documents,
 * `migration-missing` when no path exists, and `invalid-document` for malformed
 * input or failed migrations.
 * @example
 * ```ts
 * const doc = migrateDocument(JSON.parse(json))
 * canvas.loadDocument(doc, { validate: true })
 * ```
 */
export function migrateDocument(value: unknown): CanvasDocument {
  return migrateDocumentWith(value, DOCUMENT_MIGRATIONS, DOCUMENT_VERSION)
}

import { describe, expect, it } from "vitest"

import schemaText from "../../schema.json?raw"
import { AdrawCanvas } from "../canvas"
import {
  DOCUMENT_VERSION,
  migrateDocument,
  migrateDocumentWith,
  validateDocument,
  type DocumentMigration,
} from "../document"
import { createRectangle } from "../elements"
import { AdrawError, type AdrawErrorCode } from "../errors"
import type { CanvasDocument } from "../types"
import fixtureText from "./fixtures/documents/v1.json?raw"

const fixture = JSON.parse(fixtureText) as CanvasDocument
const schema = JSON.parse(schemaText) as {
  $defs: Record<string, unknown>
  $schema: string
  properties: { version: { const: number } }
}

function expectCode(run: () => unknown, code: AdrawErrorCode): AdrawError {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(AdrawError)
    const adrawError = error as AdrawError
    expect(adrawError.code).toBe(code)
    return adrawError
  }
  throw new Error(`expected AdrawError with code ${code}`)
}

describe("validateDocument", () => {
  it("accepts the v1 fixture", () => {
    const result = validateDocument(fixture)

    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it("returns issues instead of throwing for malformed input", () => {
    for (const value of [null, [], "document", 42]) {
      expect(() => validateDocument(value)).not.toThrow()
      const result = validateDocument(value)
      expect(result.valid).toBe(false)
      expect(result.issues[0]).toMatchObject({ code: "invalid-document" })
    }
  })

  it("rejects missing, invalid, old and newer versions", () => {
    expect(validateDocument({ elements: [] }).issues).toContainEqual(
      expect.objectContaining({ code: "invalid-version", path: "version" }),
    )
    expect(
      validateDocument({ elements: [], version: "1" }).issues,
    ).toContainEqual(
      expect.objectContaining({ code: "invalid-version", path: "version" }),
    )
    expect(validateDocument({ ...fixture, version: 0 }).issues).toContainEqual(
      expect.objectContaining({ code: "migration-required", path: "version" }),
    )
    expect(validateDocument({ ...fixture, version: 2 }).issues).toContainEqual(
      expect.objectContaining({ code: "unsupported-version", path: "version" }),
    )
  })

  it("reports element field issues with paths", () => {
    const bad = structuredClone(fixture)
    bad.elements[0].width = Number.NaN
    const result = validateDocument(bad)

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-value",
        path: "elements[0].width",
      }),
    )
  })

  it("rejects duplicate ids and unknown element types", () => {
    const duplicate = structuredClone(fixture)
    duplicate.elements[1].id = "rect"
    expect(validateDocument(duplicate).issues).toContainEqual(
      expect.objectContaining({
        code: "duplicate-id",
        path: "elements[1].id",
      }),
    )

    const unknown = structuredClone(fixture)
    ;(unknown.elements[1] as { type: string }).type = "star"
    expect(validateDocument(unknown).issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-element",
        path: "elements[1].type",
      }),
    )
  })

  it("rejects non-finite numbers and missing required fields", () => {
    const nonFinite = structuredClone(fixture)
    nonFinite.elements[0].zIndex = Number.POSITIVE_INFINITY
    expect(validateDocument(nonFinite).issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-value",
        path: "elements[0].zIndex",
      }),
    )

    const missing = structuredClone(fixture) as unknown as {
      elements: Record<string, unknown>[]
    }
    delete missing.elements[0].strokeColor
    expect(validateDocument(missing).issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-value",
        path: "elements[0].strokeColor",
      }),
    )
  })

  it("rejects dangling group and binding references", () => {
    const group = structuredClone(fixture)
    ;(group.elements[9] as unknown as { children: string[] }).children = [
      "missing",
    ]
    expect(validateDocument(group).issues).toContainEqual(
      expect.objectContaining({
        code: "dangling-reference",
        path: "elements[9].children",
      }),
    )

    const arrow = structuredClone(fixture)
    if (arrow.elements[4].type === "arrow") {
      arrow.elements[4].endBinding = { elementId: "missing" }
    }
    expect(validateDocument(arrow).issues).toContainEqual(
      expect.objectContaining({
        code: "dangling-reference",
        path: "elements[4].endBinding",
      }),
    )

    const text = structuredClone(fixture)
    if (text.elements[7].type === "text") {
      text.elements[7].containerId = "line"
    }
    expect(validateDocument(text).issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-reference",
        path: "elements[7].containerId",
      }),
    )
  })

  it("rejects group cycles and shared children", () => {
    const selfCycle = structuredClone(fixture)
    ;(selfCycle.elements[9] as unknown as { children: string[] }).children = [
      "group",
    ]
    expect(validateDocument(selfCycle).issues).toContainEqual(
      expect.objectContaining({ code: "group-cycle" }),
    )

    const shared = structuredClone(fixture)
    shared.elements.push({
      ...createRectangle({
        cornerRadius: 0,
        height: 10,
        id: "second-group",
        locked: false,
        rotation: 0,
        strokeColor: "#000",
        strokeWidth: 1,
        visible: true,
        width: 10,
        x: 0,
        y: 0,
        zIndex: 11,
      }),
      children: ["rect"],
      type: "group",
    } as never)
    expect(validateDocument(shared).issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-reference",
        path: "elements[10].children",
      }),
    )
  })
})

describe("migrateDocument", () => {
  it("validates and returns a current document", () => {
    const migrated = migrateDocument(fixture)

    expect(migrated.version).toBe(DOCUMENT_VERSION)
    expect(migrated.elements).toHaveLength(fixture.elements.length)
  })

  it("rejects newer, missing and malformed versions", () => {
    expectCode(
      () => migrateDocument({ ...fixture, version: 2 }),
      "unsupported-version",
    )
    expectCode(
      () => migrateDocument({ ...fixture, version: 0 }),
      "migration-missing",
    )
    expectCode(
      () => migrateDocument({ ...fixture, version: "1" }),
      "invalid-document",
    )
    expectCode(() => migrateDocument(null), "invalid-document")
  })

  it("rejects a migrated document that still fails validation", () => {
    const bad = structuredClone(fixture)
    bad.elements[0].width = Number.NaN
    const error = expectCode(() => migrateDocument(bad), "invalid-document")
    expect(error.details?.issues).toBeInstanceOf(Array)
  })

  it("runs a v1 -> v2 migration chain", () => {
    const extra = createRectangle({
      cornerRadius: 0,
      height: 10,
      id: "migrated",
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 1,
      visible: true,
      width: 10,
      x: 0,
      y: 0,
      zIndex: 11,
    })
    const migrations: DocumentMigration[] = [
      {
        from: 1,
        migrate: (doc) => ({
          ...doc,
          elements: [...(doc.elements as unknown[]), extra],
          version: 2,
        }),
        to: 2,
      },
    ]

    const migrated = migrateDocumentWith(fixture, migrations, 2)

    expect(migrated.version).toBe(2)
    expect(migrated.elements.some((element) => element.id === "migrated")).toBe(
      true,
    )
  })

  it("wraps migration failures with the original cause", () => {
    const cause = new Error("boom")
    const migrations: DocumentMigration[] = [
      {
        from: 1,
        migrate: () => {
          throw cause
        },
        to: 2,
      },
    ]

    const error = expectCode(
      () => migrateDocumentWith(fixture, migrations, 2),
      "invalid-document",
    )
    expect(error.cause).toBe(cause)
  })
})

describe("loadDocument validation", () => {
  it("loads valid documents with { validate: true }", () => {
    const canvas = new AdrawCanvas()

    canvas.loadDocument(fixture, { validate: true })

    expect(canvas.getElements().size).toBe(fixture.elements.length)
  })

  it("rejects invalid documents with { validate: true }", () => {
    const canvas = new AdrawCanvas()
    const invalid = structuredClone(fixture)
    invalid.elements[0].width = Number.NaN

    const error = expectCode(
      () => canvas.loadDocument(invalid, { validate: true }),
      "invalid-document",
    )
    expect(error.details?.issues).toBeInstanceOf(Array)
  })

  it("does not validate by default", () => {
    const canvas = new AdrawCanvas()
    const invalid = structuredClone(fixture)
    invalid.elements[0].width = Number.NaN

    expect(() => canvas.loadDocument(invalid)).not.toThrow()
  })

  it("validates initialDocument when validateDocuments is enabled", () => {
    const invalid = structuredClone(fixture)
    invalid.elements[0].width = Number.NaN

    expectCode(
      () =>
        new AdrawCanvas({
          initialDocument: invalid,
          validateDocuments: true,
        }),
      "invalid-document",
    )
  })

  it("allows a per-call override of validateDocuments", () => {
    const canvas = new AdrawCanvas({ validateDocuments: true })
    const invalid = structuredClone(fixture)
    invalid.elements[0].width = Number.NaN

    expect(() =>
      canvas.loadDocument(invalid, { validate: false }),
    ).not.toThrow()
  })
})

describe("schema.json", () => {
  it("matches the current document version and element types", () => {
    expect(schema.$schema).toContain("2020-12")
    expect(schema.properties.version.const).toBe(DOCUMENT_VERSION)
    for (const type of [
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
    ]) {
      expect(schema.$defs[type]).toBeDefined()
    }
  })

  it("requires the base and type-specific fields", () => {
    const base = schema.$defs.baseElement as { required: string[] }
    expect(base.required).toEqual(
      expect.arrayContaining([
        "id",
        "type",
        "x",
        "y",
        "width",
        "height",
        "rotation",
        "zIndex",
        "locked",
        "visible",
      ]),
    )

    const required: Record<string, string[]> = {
      arrow: ["endX", "endY", "startX", "startY", "strokeColor", "strokeWidth"],
      diamond: ["strokeColor", "strokeWidth"],
      ellipse: ["strokeColor", "strokeWidth"],
      group: ["children"],
      line: ["endX", "endY", "startX", "startY", "strokeColor", "strokeWidth"],
      media: ["mimeType", "naturalHeight", "naturalWidth", "src"],
      note: [
        "cornerRadius",
        "fillColor",
        "fontSize",
        "padding",
        "strokeColor",
        "text",
      ],
      path: ["points", "strokeColor", "strokeWidth"],
      rectangle: ["cornerRadius", "strokeColor", "strokeWidth"],
      text: ["fontSize", "strokeColor", "text"],
    }

    for (const [type, fields] of Object.entries(required)) {
      const def = schema.$defs[type] as {
        allOf: { required?: string[] }[]
      }
      expect(def.allOf[1].required).toEqual(expect.arrayContaining(fields))
    }
  })
})

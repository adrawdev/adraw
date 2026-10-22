import type { ToolType } from "@adraw/core"
import {
  Canvas,
  CanvasProvider,
  useCanvasEngine,
  useHistory,
  useTool,
  useViewport,
} from "@adraw/react"

function Toolbar() {
  const { engine } = useCanvasEngine()
  const { tool, setTool } = useTool()
  const { zoomIn, zoomOut, zoomToFit, resetZoom } = useViewport()
  const { undo, redo, canUndo, canRedo } = useHistory()

  const tools: { id: ToolType; label: string; shortcut: string }[] = [
    { id: "select", label: "Select", shortcut: "V" },
    { id: "hand", label: "Hand", shortcut: "H" },
    { id: "rectangle", label: "Rectangle", shortcut: "R" },
    { id: "ellipse", label: "Ellipse", shortcut: "E" },
    { id: "draw", label: "Draw", shortcut: "D" },
    { id: "arrow", label: "Arrow", shortcut: "A" },
    { id: "eraser", label: "Eraser", shortcut: "E" },
    { id: "text", label: "Text", shortcut: "T" },
    { id: "note", label: "Note", shortcut: "N" },
  ]

  return (
    <div style={styles.toolbar}>
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          style={{
            ...styles.button,
            ...(tool === t.id ? styles.activeButton : {}),
          }}
          onClick={() => setTool(t.id)}
          title={`${t.label} (${t.shortcut})`}
        >
          {t.label}
        </button>
      ))}
      <div style={styles.separator} />
      <button
        type="button"
        style={styles.button}
        onClick={undo}
        disabled={!canUndo()}
      >
        Undo
      </button>
      <button
        type="button"
        style={styles.button}
        onClick={redo}
        disabled={!canRedo()}
      >
        Redo
      </button>
      <div style={styles.separator} />
      <button
        type="button"
        style={styles.button}
        title="Copy (Ctrl+C)"
        onClick={() => engine.copy()}
      >
        Copy
      </button>
      <button
        type="button"
        style={styles.button}
        title="Cut (Ctrl+X)"
        onClick={() => engine.cut()}
      >
        Cut
      </button>
      <button
        type="button"
        style={styles.button}
        title="Paste (Ctrl+V)"
        onClick={() => engine.paste()}
      >
        Paste
      </button>
      <div style={styles.separator} />
      <button type="button" style={styles.button} onClick={zoomIn}>
        +
      </button>
      <button type="button" style={styles.button} onClick={zoomOut}>
        -
      </button>
      <button type="button" style={styles.button} onClick={() => zoomToFit()}>
        Fit
      </button>
      <button type="button" style={styles.button} onClick={resetZoom}>
        Reset
      </button>
    </div>
  )
}

function StyleBar() {
  const { engine } = useCanvasEngine()

  return (
    <div style={styles.styleBar}>
      <label style={styles.control}>
        Stroke
        <input
          type="range"
          min="1"
          max="16"
          defaultValue={2}
          onChange={(event) =>
            engine.setStyle({ strokeWidth: Number(event.target.value) })
          }
        />
      </label>
    </div>
  )
}

function App() {
  return (
    <CanvasProvider>
      <div style={styles.app}>
        <Toolbar />
        <StyleBar />
        <Canvas
          style={{
            background: "white",
            height: "calc(100vh - 50px)",
            width: "100%",
          }}
        />
      </div>
    </CanvasProvider>
  )
}

const styles: Record<string, React.CSSProperties> = {
  activeButton: {
    background: "#2196f3",
    borderColor: "#1976d2",
    color: "white",
  },
  app: {
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
    height: "100vh",
    width: "100vw",
  },
  button: {
    background: "white",
    border: "1px solid #ccc",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    padding: "8px 12px",
  },
  control: {
    alignItems: "center",
    display: "flex",
    fontSize: "13px",
    gap: "6px",
  },
  separator: {
    background: "#ddd",
    margin: "0 8px",
    width: "1px",
  },
  styleBar: {
    alignItems: "center",
    background: "#fafafa",
    borderBottom: "1px solid #ddd",
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    padding: "6px 8px",
  },
  toolbar: {
    background: "#f5f5f5",
    borderBottom: "1px solid #ddd",
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    padding: "8px",
  },
}

export default App

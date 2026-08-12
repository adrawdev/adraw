import type { ToolType } from "@adraw/core"
import {
  Canvas,
  CanvasProvider,
  useHistory,
  useTool,
  useViewport,
} from "@adraw/solid"
import { For, type JSX } from "solid-js"

const tools: { id: ToolType; label: string; shortcut: string }[] = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "hand", label: "Hand", shortcut: "H" },
  { id: "rectangle", label: "Rectangle", shortcut: "R" },
  { id: "ellipse", label: "Ellipse", shortcut: "E" },
  { id: "draw", label: "Draw", shortcut: "D" },
  { id: "eraser", label: "Eraser", shortcut: "E" },
  { id: "text", label: "Text", shortcut: "T" },
]

function Toolbar() {
  const toolCtx = useTool()
  const { zoomIn, zoomOut, zoomToFit, resetZoom } = useViewport()
  const { undo, redo, canUndo, canRedo } = useHistory()

  return (
    <div style={styles.toolbar}>
      <For each={tools}>
        {(t) => (
          <button
            type="button"
            style={{
              ...styles.button,
              ...(toolCtx.tool === t.id ? styles.activeButton : {}),
            }}
            onClick={() => toolCtx.setTool(t.id)}
            title={`${t.label} (${t.shortcut})`}
          >
            {t.label}
          </button>
        )}
      </For>
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
      <button type="button" style={styles.button} onClick={zoomIn}>
        +
      </button>
      <button type="button" style={styles.button} onClick={zoomOut}>
        -
      </button>
      <button type="button" style={styles.button} onClick={zoomToFit}>
        Fit
      </button>
      <button type="button" style={styles.button} onClick={resetZoom}>
        Reset
      </button>
    </div>
  )
}

function CanvasPane(props: { title: string }) {
  return (
    <CanvasProvider>
      <div style={styles.pane}>
        <div style={styles.paneTitle}>{props.title}</div>
        <Toolbar />
        <Canvas style={{ background: "white", flex: "1", width: "100%" }} />
      </div>
    </CanvasProvider>
  )
}

function App() {
  return (
    <div style={styles.app}>
      <CanvasPane title="Canvas A" />
      <CanvasPane title="Canvas B" />
    </div>
  )
}

const styles: Record<string, JSX.CSSProperties> = {
  activeButton: {
    background: "#2196f3",
    "border-color": "#1976d2",
    color: "white",
  },
  app: {
    background: "#ddd",
    display: "flex",
    "font-family": "system-ui, sans-serif",
    gap: "1px",
    height: "100vh",
    width: "100vw",
  },
  button: {
    background: "white",
    border: "1px solid #ccc",
    "border-radius": "4px",
    cursor: "pointer",
    "font-size": "14px",
    padding: "8px 12px",
  },
  pane: {
    display: "flex",
    flex: "1",
    "flex-direction": "column",
    "min-width": "0",
  },
  paneTitle: {
    background: "#333",
    color: "white",
    "font-size": "12px",
    padding: "4px 8px",
  },
  separator: {
    background: "#ddd",
    margin: "0 8px",
    width: "1px",
  },
  toolbar: {
    background: "#f5f5f5",
    "border-bottom": "1px solid #ddd",
    display: "flex",
    "flex-wrap": "wrap",
    gap: "4px",
    padding: "8px",
  },
}

export default App

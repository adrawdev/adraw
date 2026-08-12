import { useHistory, useTool, useViewport } from "@adraw/angular"
import type { ToolType } from "@adraw/core"
import { Component, input } from "@angular/core"

@Component({
  selector: "app-toolbar",
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
      }
      .label {
        font-weight: 600;
        font-size: 13px;
        margin-right: 8px;
        color: #555;
      }
      button {
        padding: 8px 12px;
        border: 1px solid #ccc;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      button:hover {
        background: #e8e8e8;
      }
      button.active {
        background: #2196f3;
        color: white;
        border-color: #1976d2;
      }
      button:disabled {
        cursor: default;
        opacity: 0.5;
      }
      .separator {
        background: #ddd;
        margin: 0 4px;
        width: 1px;
        align-self: stretch;
      }
    `,
  ],
  template: `
    <div class="toolbar">
      <span class="label">{{ label() }}</span>
      @for (t of tools; track t.id) {
        <button
          [class.active]="toolApi.tool() === t.id"
          [title]="t.label + ' (' + t.shortcut + ')'"
          (click)="toolApi.setTool(t.id)"
        >
          {{ t.label }}
        </button>
      }
      <div class="separator"></div>
      <button [disabled]="!historyApi.canUndo()" (click)="historyApi.undo()">
        Undo
      </button>
      <button [disabled]="!historyApi.canRedo()" (click)="historyApi.redo()">
        Redo
      </button>
      <div class="separator"></div>
      <button (click)="viewportApi.zoomIn()">+</button>
      <button (click)="viewportApi.zoomOut()">-</button>
      <button (click)="viewportApi.zoomToFit()">Fit</button>
      <button (click)="viewportApi.resetZoom()">Reset</button>
    </div>
  `,
})
export class Toolbar {
  readonly label = input("")

  protected readonly toolApi = useTool()
  protected readonly viewportApi = useViewport()
  protected readonly historyApi = useHistory()

  protected readonly tools: {
    id: ToolType
    label: string
    shortcut: string
  }[] = [
    { id: "select", label: "Select", shortcut: "V" },
    { id: "hand", label: "Hand", shortcut: "H" },
    { id: "rectangle", label: "Rectangle", shortcut: "R" },
    { id: "ellipse", label: "Ellipse", shortcut: "O" },
    { id: "draw", label: "Draw", shortcut: "D" },
    { id: "eraser", label: "Eraser", shortcut: "E" },
    { id: "text", label: "Text", shortcut: "T" },
  ]
}

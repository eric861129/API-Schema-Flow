/** 版面資料只含穩定節點 ID 與數值，不保存 React Flow／ELK 物件。 */
export interface CanvasLayoutState {
  readonly positions: readonly { readonly id: string; readonly x: number; readonly y: number }[]
  readonly viewport?: { readonly x: number; readonly y: number; readonly zoom: number }
}
export interface WorkspaceLayoutState {
  readonly direction: 'right' | 'down'
  readonly topology: CanvasLayoutState
  readonly review: CanvasLayoutState
}
export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayoutState = {
  direction: 'right',
  topology: { positions: [] },
  review: { positions: [] },
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid project layout.')
  return value as Record<string, unknown>
}
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new Error('Unsupported project layout field.')
}
function coordinate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000)
    throw new Error('Invalid layout coordinate.')
  return value
}
/** 匯入與本機還原共用驗證，未知 ID 或非有限座標不會部分套用。 */
export function parseWorkspaceLayout(
  value: unknown,
  nodeIds: ReadonlySet<string>,
): WorkspaceLayoutState {
  const root = object(value)
  exact(root, ['direction', 'topology', 'review'])
  if (root.direction !== 'right' && root.direction !== 'down')
    throw new Error('Invalid layout direction.')
  function canvas(value: unknown): CanvasLayoutState {
    const item = object(value)
    exact(item, ['positions', 'viewport'])
    if (!Array.isArray(item.positions) || item.positions.length > nodeIds.size)
      throw new Error('Invalid layout positions.')
    const seen = new Set<string>()
    const positions = item.positions
      .map((value) => {
        const node = object(value)
        exact(node, ['id', 'x', 'y'])
        if (typeof node.id !== 'string' || !nodeIds.has(node.id) || seen.has(node.id))
          throw new Error('Unknown or duplicate layout node.')
        seen.add(node.id)
        return { id: node.id, x: coordinate(node.x), y: coordinate(node.y) }
      })
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    if (item.viewport === undefined) return { positions }
    const viewport = object(item.viewport)
    exact(viewport, ['x', 'y', 'zoom'])
    if (
      typeof viewport.zoom !== 'number' ||
      !Number.isFinite(viewport.zoom) ||
      viewport.zoom < 0.3 ||
      viewport.zoom > 1.8
    )
      throw new Error('Invalid viewport zoom.')
    return {
      positions,
      viewport: { x: coordinate(viewport.x), y: coordinate(viewport.y), zoom: viewport.zoom },
    }
  }
  return { direction: root.direction, topology: canvas(root.topology), review: canvas(root.review) }
}

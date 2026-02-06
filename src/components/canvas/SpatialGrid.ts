import type { AABB } from "@/types";

const CELL_SIZE = 200;

/**
 * Client-side spatial grid for quick viewport queries.
 * Used in the main thread to determine which sprites to show.
 */
export class SpatialGrid {
  private cells = new Map<number, Set<string>>();
  private entityCells = new Map<string, number>();
  private gridCols: number;

  constructor(worldWidth: number) {
    this.gridCols = Math.ceil(worldWidth / CELL_SIZE);
  }

  private cellIndex(x: number, y: number): number {
    const col = Math.floor(Math.max(0, x) / CELL_SIZE);
    const row = Math.floor(Math.max(0, y) / CELL_SIZE);
    return row * this.gridCols + col;
  }

  update(address: string, x: number, y: number): void {
    const idx = this.cellIndex(x, y);
    const oldIdx = this.entityCells.get(address);
    if (oldIdx === idx) return;

    if (oldIdx !== undefined) {
      const cell = this.cells.get(oldIdx);
      if (cell) {
        cell.delete(address);
        if (cell.size === 0) this.cells.delete(oldIdx);
      }
    }

    let cell = this.cells.get(idx);
    if (!cell) {
      cell = new Set();
      this.cells.set(idx, cell);
    }
    cell.add(address);
    this.entityCells.set(address, idx);
  }

  query(bounds: AABB): Set<string> {
    const result = new Set<string>();
    const minCol = Math.max(0, Math.floor(bounds.x1 / CELL_SIZE));
    const maxCol = Math.floor(bounds.x2 / CELL_SIZE);
    const minRow = Math.max(0, Math.floor(bounds.y1 / CELL_SIZE));
    const maxRow = Math.floor(bounds.y2 / CELL_SIZE);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cell = this.cells.get(row * this.gridCols + col);
        if (cell) {
          for (const addr of cell) {
            result.add(addr);
          }
        }
      }
    }
    return result;
  }

  remove(address: string): void {
    const idx = this.entityCells.get(address);
    if (idx !== undefined) {
      const cell = this.cells.get(idx);
      if (cell) {
        cell.delete(address);
        if (cell.size === 0) this.cells.delete(idx);
      }
      this.entityCells.delete(address);
    }
  }

  clear(): void {
    this.cells.clear();
    this.entityCells.clear();
  }
}

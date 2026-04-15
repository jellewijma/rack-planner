/**
 * Canvas — Manages the infinite pannable/zoomable canvas.
 */

const GRID_SIZE = 20;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

export class Canvas {
  constructor(viewportEl, canvasEl) {
    this.viewport = viewportEl;
    this.canvas = canvasEl;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.showGrid = true;
    this.snapEnabled = true;
    this.onZoomChange = null;

    this._initPan();
    this._initZoom();
    this._applyTransform();
    this._updateGrid();

    // Center the canvas initially
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    this.panX = -4000 + vw / 2;
    this.panY = -4000 + vh / 2;
    this._applyTransform();
  }

  _initPan() {
    let lastX, lastY;

    this.viewport.addEventListener('pointerdown', (e) => {
      // Only pan on middle click or when clicking the canvas background
      if (e.button === 1 || (e.button === 0 && e.target === this.canvas)) {
        this.isPanning = true;
        this.viewport.classList.add('is-panning');
        lastX = e.clientX;
        lastY = e.clientY;
        this.viewport.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });

    this.viewport.addEventListener('pointermove', (e) => {
      if (!this.isPanning) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.panX += dx;
      this.panY += dy;
      this._applyTransform();
    });

    this.viewport.addEventListener('pointerup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.classList.remove('is-panning');
      }
    });
  }

  _initZoom() {
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      const oldZoom = this.zoom;
      this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom + direction * ZOOM_STEP));

      // Zoom toward cursor
      const rect = this.viewport.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      this.panX = mx - (mx - this.panX) * (this.zoom / oldZoom);
      this.panY = my - (my - this.panY) * (this.zoom / oldZoom);

      this._applyTransform();
      if (this.onZoomChange) this.onZoomChange(this.zoom);
    }, { passive: false });
  }

  _applyTransform() {
    this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  _updateGrid() {
    if (this.showGrid) {
      this.canvas.classList.add('canvas-grid');
      this.canvas.classList.remove('canvas-grid-hidden');
    } else {
      this.canvas.classList.remove('canvas-grid');
      this.canvas.classList.add('canvas-grid-hidden');
    }
  }

  setShowGrid(show) {
    this.showGrid = show;
    this._updateGrid();
  }

  setSnapEnabled(enabled) {
    this.snapEnabled = enabled;
  }

  zoomIn() {
    this.zoom = Math.min(MAX_ZOOM, this.zoom + ZOOM_STEP);
    this._applyTransform();
    if (this.onZoomChange) this.onZoomChange(this.zoom);
  }

  zoomOut() {
    this.zoom = Math.max(MIN_ZOOM, this.zoom - ZOOM_STEP);
    this._applyTransform();
    if (this.onZoomChange) this.onZoomChange(this.zoom);
  }

  /** Convert screen coordinates to canvas coordinates */
  screenToCanvas(sx, sy) {
    const rect = this.viewport.getBoundingClientRect();
    return {
      x: (sx - rect.left - this.panX) / this.zoom,
      y: (sy - rect.top - this.panY) / this.zoom,
    };
  }

  /** Convert canvas coordinates to screen coordinates */
  canvasToScreen(cx, cy) {
    const rect = this.viewport.getBoundingClientRect();
    return {
      x: cx * this.zoom + this.panX + rect.left,
      y: cy * this.zoom + this.panY + rect.top,
    };
  }

  /** Snap a value to grid */
  snapToGrid(value) {
    if (!this.snapEnabled) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  /** Get the center of the visible viewport in canvas coordinates */
  getViewportCenter() {
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    return this.screenToCanvas(
      this.viewport.getBoundingClientRect().left + vw / 2,
      this.viewport.getBoundingClientRect().top + vh / 2
    );
  }

  getState() {
    return { zoom: this.zoom, panX: this.panX, panY: this.panY };
  }

  setState(state) {
    if (state.zoom != null) this.zoom = state.zoom;
    if (state.panX != null) this.panX = state.panX;
    if (state.panY != null) this.panY = state.panY;
    this._applyTransform();
    if (this.onZoomChange) this.onZoomChange(this.zoom);
  }
}

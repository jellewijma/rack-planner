/**
 * crop.js — Interactive image cropping tool.
 * Allows click-drag to select a region, then applies the crop.
 */

export class CropTool {
    /**
     * @param {HTMLCanvasElement} sourceCanvas - The image canvas
     * @param {HTMLElement} canvasArea - The container element
     * @param {Object} callbacks - { onCropApplied: () => void }
     */
    constructor(sourceCanvas, canvasArea, callbacks = {}) {
        this.sourceCanvas = sourceCanvas;
        this.canvasArea = canvasArea;
        this.callbacks = callbacks;
        this.active = false;
        this.dragging = false;

        // Crop rect in CANVAS coordinates (not screen)
        this.cropRect = { x: 0, y: 0, w: 0, h: 0 };
        this.startX = 0;
        this.startY = 0;

        // Create crop overlay elements
        this.overlay = document.createElement('div');
        this.overlay.className = 'crop-overlay hidden';

        // Dimmed regions (4 divs around the selection)
        this.dimTop = document.createElement('div');
        this.dimBottom = document.createElement('div');
        this.dimLeft = document.createElement('div');
        this.dimRight = document.createElement('div');
        [this.dimTop, this.dimBottom, this.dimLeft, this.dimRight].forEach(d => {
            d.className = 'crop-dim';
            this.overlay.appendChild(d);
        });

        // Selection box
        this.selBox = document.createElement('div');
        this.selBox.className = 'crop-selection';
        this.overlay.appendChild(this.selBox);

        // Size label
        this.sizeLabel = document.createElement('div');
        this.sizeLabel.className = 'crop-size-label';
        this.selBox.appendChild(this.sizeLabel);

        // Resize handles (corners)
        ['nw', 'ne', 'sw', 'se'].forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `crop-handle crop-handle-${pos}`;
            handle.dataset.handle = pos;
            this.selBox.appendChild(handle);
        });

        // Apply & Cancel buttons
        this.actions = document.createElement('div');
        this.actions.className = 'crop-actions';
        this.actions.innerHTML = `
            <button class="crop-btn crop-btn-apply">✓ Apply Crop</button>
            <button class="crop-btn crop-btn-cancel">✕ Cancel</button>
        `;
        this.overlay.appendChild(this.actions);

        canvasArea.appendChild(this.overlay);

        // Bind events
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onHandleDown = this._onHandleDown.bind(this);

        this.actions.querySelector('.crop-btn-apply').addEventListener('click', () => this.applyCrop());
        this.actions.querySelector('.crop-btn-cancel').addEventListener('click', () => this.deactivate());
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.overlay.classList.remove('hidden');

        // Default selection: center 80%
        const rect = this.sourceCanvas.getBoundingClientRect();
        const margin = 0.1;
        this.cropRect = {
            x: margin * rect.width,
            y: margin * rect.height,
            w: (1 - 2 * margin) * rect.width,
            h: (1 - 2 * margin) * rect.height,
        };
        this._updateVisuals();

        // Listen for drag to create new selection
        this.overlay.addEventListener('pointerdown', this._onPointerDown);
        document.addEventListener('pointermove', this._onPointerMove);
        document.addEventListener('pointerup', this._onPointerUp);

        // Handle resizing
        this.overlay.querySelectorAll('.crop-handle').forEach(h => {
            h.addEventListener('pointerdown', this._onHandleDown);
        });
    }

    deactivate() {
        this.active = false;
        this.dragging = false;
        this.resizing = false;
        this.overlay.classList.add('hidden');
        this.overlay.removeEventListener('pointerdown', this._onPointerDown);
        document.removeEventListener('pointermove', this._onPointerMove);
        document.removeEventListener('pointerup', this._onPointerUp);
    }

    applyCrop() {
        const canvasRect = this.sourceCanvas.getBoundingClientRect();
        const scaleX = this.sourceCanvas.width / canvasRect.width;
        const scaleY = this.sourceCanvas.height / canvasRect.height;

        // Convert screen-relative crop to canvas pixels
        const sx = Math.round(this.cropRect.x * scaleX);
        const sy = Math.round(this.cropRect.y * scaleY);
        const sw = Math.round(this.cropRect.w * scaleX);
        const sh = Math.round(this.cropRect.h * scaleY);

        if (sw < 10 || sh < 10) return;

        const ctx = this.sourceCanvas.getContext('2d');
        const imageData = ctx.getImageData(sx, sy, sw, sh);

        this.sourceCanvas.width = sw;
        this.sourceCanvas.height = sh;
        ctx.putImageData(imageData, 0, 0);

        this.deactivate();
        this.callbacks.onCropApplied?.();
    }

    // ─── Pointer Events ────────────────────────────────────

    _onPointerDown(e) {
        // Ignore if clicking on a handle or button
        if (e.target.closest('.crop-handle') || e.target.closest('.crop-btn')) return;

        const rect = this.sourceCanvas.getBoundingClientRect();
        const areaRect = this.canvasArea.getBoundingClientRect();
        const offsetX = rect.left - areaRect.left;
        const offsetY = rect.top - areaRect.top;

        this.dragging = true;
        this.startX = e.clientX - areaRect.left - offsetX;
        this.startY = e.clientY - areaRect.top - offsetY;
        this.cropRect = { x: this.startX, y: this.startY, w: 0, h: 0 };
        e.preventDefault();
    }

    _onPointerMove(e) {
        if (this.resizing) {
            this._handleResize(e);
            return;
        }

        if (!this.dragging) return;

        const rect = this.sourceCanvas.getBoundingClientRect();
        const areaRect = this.canvasArea.getBoundingClientRect();
        const offsetX = rect.left - areaRect.left;
        const offsetY = rect.top - areaRect.top;

        const curX = e.clientX - areaRect.left - offsetX;
        const curY = e.clientY - areaRect.top - offsetY;

        this.cropRect.x = Math.min(this.startX, curX);
        this.cropRect.y = Math.min(this.startY, curY);
        this.cropRect.w = Math.abs(curX - this.startX);
        this.cropRect.h = Math.abs(curY - this.startY);

        // Clamp to canvas bounds
        const maxW = rect.width;
        const maxH = rect.height;
        this.cropRect.x = Math.max(0, this.cropRect.x);
        this.cropRect.y = Math.max(0, this.cropRect.y);
        if (this.cropRect.x + this.cropRect.w > maxW) this.cropRect.w = maxW - this.cropRect.x;
        if (this.cropRect.y + this.cropRect.h > maxH) this.cropRect.h = maxH - this.cropRect.y;

        this._updateVisuals();
    }

    _onPointerUp() {
        this.dragging = false;
        this.resizing = false;
        this.activeHandle = null;
    }

    // ─── Handle Resize ─────────────────────────────────────

    _onHandleDown(e) {
        e.stopPropagation();
        e.preventDefault();
        this.resizing = true;
        this.activeHandle = e.target.dataset.handle;

        const areaRect = this.canvasArea.getBoundingClientRect();
        const canvasRect = this.sourceCanvas.getBoundingClientRect();
        this.handleStartX = e.clientX;
        this.handleStartY = e.clientY;
        this.handleStartRect = { ...this.cropRect };
        this._canvasOffset = {
            x: canvasRect.left - areaRect.left,
            y: canvasRect.top - areaRect.top,
        };
    }

    _handleResize(e) {
        const dx = e.clientX - this.handleStartX;
        const dy = e.clientY - this.handleStartY;
        const r = { ...this.handleStartRect };

        switch (this.activeHandle) {
            case 'se':
                r.w += dx; r.h += dy;
                break;
            case 'sw':
                r.x += dx; r.w -= dx; r.h += dy;
                break;
            case 'ne':
                r.y += dy; r.w += dx; r.h -= dy;
                break;
            case 'nw':
                r.x += dx; r.y += dy; r.w -= dx; r.h -= dy;
                break;
        }

        // Enforce minimum size
        if (r.w >= 20 && r.h >= 20) {
            this.cropRect = r;
            this._updateVisuals();
        }
    }

    // ─── Visual Update ─────────────────────────────────────

    _updateVisuals() {
        const canvasRect = this.sourceCanvas.getBoundingClientRect();
        const areaRect = this.canvasArea.getBoundingClientRect();

        // Calculate canvas position within the area
        const offsetX = canvasRect.left - areaRect.left;
        const offsetY = canvasRect.top - areaRect.top;
        const cw = canvasRect.width;
        const ch = canvasRect.height;

        const r = this.cropRect;
        const left = offsetX + r.x;
        const top = offsetY + r.y;

        // Selection box
        this.selBox.style.left = `${left}px`;
        this.selBox.style.top = `${top}px`;
        this.selBox.style.width = `${r.w}px`;
        this.selBox.style.height = `${r.h}px`;

        // Dims
        this.dimTop.style.left = `${offsetX}px`;
        this.dimTop.style.top = `${offsetY}px`;
        this.dimTop.style.width = `${cw}px`;
        this.dimTop.style.height = `${r.y}px`;

        this.dimBottom.style.left = `${offsetX}px`;
        this.dimBottom.style.top = `${top + r.h}px`;
        this.dimBottom.style.width = `${cw}px`;
        this.dimBottom.style.height = `${ch - r.y - r.h}px`;

        this.dimLeft.style.left = `${offsetX}px`;
        this.dimLeft.style.top = `${top}px`;
        this.dimLeft.style.width = `${r.x}px`;
        this.dimLeft.style.height = `${r.h}px`;

        this.dimRight.style.left = `${left + r.w}px`;
        this.dimRight.style.top = `${top}px`;
        this.dimRight.style.width = `${cw - r.x - r.w}px`;
        this.dimRight.style.height = `${r.h}px`;

        // Size label
        const scaleX = this.sourceCanvas.width / cw;
        const scaleY = this.sourceCanvas.height / ch;
        const pw = Math.round(r.w * scaleX);
        const ph = Math.round(r.h * scaleY);
        this.sizeLabel.textContent = `${pw} × ${ph}`;

        // Position actions below selection
        this.actions.style.left = `${left}px`;
        this.actions.style.top = `${top + r.h + 8}px`;
    }
}

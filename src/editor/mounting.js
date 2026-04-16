/**
 * mounting.js — Interactive rack mounting hardware overlay.
 * User can drag top/bottom edge handles to position rack ears,
 * and the U height is calculated from the ear span.
 */

const U_HEIGHT_INCHES = 1.75;
const RACK_WIDTH_INCHES = 19;
const RACK_EAR_WIDTH_RATIO = 0.625 / 19; // ear width as fraction of total
const SCREW_OFFSETS_RATIO = [0.25 / 1.75, 0.625 / 1.75, 1.25 / 1.75]; // within each U

export class MountingOverlay {
    /**
     * @param {HTMLElement} canvasArea - The image container
     * @param {HTMLCanvasElement} imageCanvas - The equipment image canvas
     * @param {Object} callbacks - { onHeightChanged: (u) => void }
     */
    constructor(canvasArea, imageCanvas, callbacks = {}) {
        this.canvasArea = canvasArea;
        this.imageCanvas = imageCanvas;
        this.callbacks = callbacks;
        this.visible = false;

        // State: positions as fraction of image height (0..1)
        this.topFraction = 0;
        this.bottomFraction = 1;
        this.heightU = 1;

        // Create overlay container
        this.el = document.createElement('div');
        this.el.className = 'mounting-interactive hidden';

        // Left ear
        this.leftEar = document.createElement('div');
        this.leftEar.className = 'mount-ear mount-ear-left';

        // Right ear
        this.rightEar = document.createElement('div');
        this.rightEar.className = 'mount-ear mount-ear-right';

        // Top drag handle
        this.topHandle = document.createElement('div');
        this.topHandle.className = 'mount-handle mount-handle-top';
        this.topHandle.innerHTML = '<div class="mount-handle-grip">▲ Top Edge</div>';

        // Bottom drag handle
        this.bottomHandle = document.createElement('div');
        this.bottomHandle.className = 'mount-handle mount-handle-bottom';
        this.bottomHandle.innerHTML = '<div class="mount-handle-grip">▼ Bottom Edge</div>';

        // U-height label
        this.uLabel = document.createElement('div');
        this.uLabel.className = 'mount-u-label';

        // Screw holes canvas
        this.screwCanvas = document.createElement('canvas');
        this.screwCanvas.className = 'mount-screw-canvas';

        // U division lines container
        this.divLines = document.createElement('div');
        this.divLines.className = 'mount-div-lines';

        this.el.appendChild(this.leftEar);
        this.el.appendChild(this.rightEar);
        this.el.appendChild(this.topHandle);
        this.el.appendChild(this.bottomHandle);
        this.el.appendChild(this.uLabel);
        this.el.appendChild(this.screwCanvas);
        this.el.appendChild(this.divLines);

        canvasArea.appendChild(this.el);

        // Bind drag events
        this._setupDrag(this.topHandle, 'top');
        this._setupDrag(this.bottomHandle, 'bottom');
    }

    show(heightU = 1) {
        this.visible = true;
        this.heightU = heightU;
        this.topFraction = 0;
        this.bottomFraction = 1;
        this.el.classList.remove('hidden');
        this._update();
    }

    hide() {
        this.visible = false;
        this.el.classList.add('hidden');
    }

    toggle(heightU) {
        if (this.visible) {
            this.hide();
        } else {
            this.show(heightU);
        }
        return this.visible;
    }

    _setupDrag(handle, which) {
        let startY, startFrac;

        const onDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            startY = e.clientY;
            startFrac = which === 'top' ? this.topFraction : this.bottomFraction;
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
            handle.classList.add('dragging');
        };

        const onMove = (e) => {
            const canvasRect = this.imageCanvas.getBoundingClientRect();
            const dy = e.clientY - startY;
            const deltaFrac = dy / canvasRect.height;
            let newFrac = startFrac + deltaFrac;
            newFrac = Math.max(0, Math.min(1, newFrac));

            if (which === 'top') {
                // Can't go below bottom
                if (newFrac < this.bottomFraction - 0.05) {
                    this.topFraction = newFrac;
                }
            } else {
                // Can't go above top
                if (newFrac > this.topFraction + 0.05) {
                    this.bottomFraction = newFrac;
                }
            }

            this._calcU();
            this._update();
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            handle.classList.remove('dragging');
            this.callbacks.onHeightChanged?.(this.heightU);
        };

        handle.addEventListener('pointerdown', onDown);
    }

    _calcU() {
        const span = this.bottomFraction - this.topFraction;
        // Calculate the most likely U from the span
        // Image height should represent total equipment height
        // So if ears cover 100%, it's the full U count
        // We round to nearest integer U
        const canvasRect = this.imageCanvas.getBoundingClientRect();
        const earSpanPx = span * canvasRect.height;
        const imageHeightPx = canvasRect.height;

        // The user is marking where the rack ears ARE on the image.
        // We need to figure out how many U that span represents.
        // A rough heuristic: aspect ratio tells us.
        // Standard: 19" wide, 1.75" per U
        const imageAspect = this.imageCanvas.width / this.imageCanvas.height;
        const totalHeightInches = RACK_WIDTH_INCHES / imageAspect;
        const earSpanInches = totalHeightInches * span;
        const uFloat = earSpanInches / U_HEIGHT_INCHES;
        this.heightU = Math.max(1, Math.round(uFloat));
    }

    _update() {
        const canvasRect = this.imageCanvas.getBoundingClientRect();
        const areaRect = this.canvasArea.getBoundingClientRect();
        const offsetX = canvasRect.left - areaRect.left;
        const offsetY = canvasRect.top - areaRect.top;
        const cw = canvasRect.width;
        const ch = canvasRect.height;

        const topPx = offsetY + this.topFraction * ch;
        const bottomPx = offsetY + this.bottomFraction * ch;
        const earSpanPx = bottomPx - topPx;

        const earW = cw * RACK_EAR_WIDTH_RATIO;

        // Left ear
        this.leftEar.style.left = `${offsetX}px`;
        this.leftEar.style.top = `${topPx}px`;
        this.leftEar.style.width = `${earW}px`;
        this.leftEar.style.height = `${earSpanPx}px`;

        // Right ear
        this.rightEar.style.left = `${offsetX + cw - earW}px`;
        this.rightEar.style.top = `${topPx}px`;
        this.rightEar.style.width = `${earW}px`;
        this.rightEar.style.height = `${earSpanPx}px`;

        // Handles
        this.topHandle.style.left = `${offsetX}px`;
        this.topHandle.style.top = `${topPx - 2}px`;
        this.topHandle.style.width = `${cw}px`;

        this.bottomHandle.style.left = `${offsetX}px`;
        this.bottomHandle.style.top = `${bottomPx - 2}px`;
        this.bottomHandle.style.width = `${cw}px`;

        // U label
        this.uLabel.style.left = `${offsetX + cw + 8}px`;
        this.uLabel.style.top = `${topPx + earSpanPx / 2 - 14}px`;
        this.uLabel.textContent = `${this.heightU}U`;

        // Division lines
        this.divLines.innerHTML = '';
        if (this.heightU > 1) {
            for (let u = 1; u < this.heightU; u++) {
                const frac = u / this.heightU;
                const y = topPx + frac * earSpanPx;
                const line = document.createElement('div');
                line.className = 'mount-div-line';
                line.style.top = `${y}px`;
                line.style.left = `${offsetX}px`;
                line.style.width = `${cw}px`;
                this.divLines.appendChild(line);
            }
        }

        // Draw screw holes
        this._drawScrews(offsetX, topPx, cw, earSpanPx, earW);
    }

    _drawScrews(offsetX, topPx, cw, earSpanPx, earW) {
        this.screwCanvas.width = this.canvasArea.offsetWidth;
        this.screwCanvas.height = this.canvasArea.offsetHeight;
        const ctx = this.screwCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.screwCanvas.width, this.screwCanvas.height);

        const uHeightPx = earSpanPx / this.heightU;
        const screwR = Math.max(2, earW * 0.12);

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        ctx.fillStyle = 'rgba(99, 102, 241, 0.6)';
        ctx.lineWidth = 1.5;

        for (let u = 0; u < this.heightU; u++) {
            const uTopY = topPx + u * uHeightPx;

            for (const offset of SCREW_OFFSETS_RATIO) {
                const holeY = uTopY + offset * uHeightPx;
                const leftX = offsetX + earW / 2;
                const rightX = offsetX + cw - earW / 2;

                // Left screws
                this._drawHole(ctx, leftX, holeY, screwR);
                // Right screws
                this._drawHole(ctx, rightX, holeY, screwR);
            }
        }
    }

    _drawHole(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Keep the old static functions for backward compat
export function drawMountingOverlay() {}
export function clearMountingOverlay() {}

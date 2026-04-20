/**
 * rack-calibration.js — Interactive tool to align the "rack rails" bounding box in a custom rack image.
 */

const U_HEIGHT_INCHES = 1.75;
const RACK_WIDTH_INCHES = 19;

export class RackCalibrationTool {
    /**
     * @param {HTMLElement} canvasArea
     * @param {HTMLCanvasElement} imageCanvas
     */
    constructor(canvasArea, imageCanvas) {
        this.canvasArea = canvasArea;
        this.imageCanvas = imageCanvas;
        this.active = false;
        
        this.heightU = 1;
        
        // Calibration bounds relative to original image size (0..1)
        this.bounds = {
            x: 0.1, y: 0.1, w: 0.8, h: undefined // h will be calculated based on aspect ratio
        };

        // DOM elements
        this.el = document.createElement('div');
        this.el.className = 'calibration-interactive hidden';
        
        // The bounding box representing the "rails hole"
        this.box = document.createElement('div');
        this.box.className = 'calib-box';
        
        // Label
        this.label = document.createElement('div');
        this.label.className = 'calib-label';
        this.box.appendChild(this.label);
        
        // Handles for resize
        const handles = ['nw', 'ne', 'sw', 'se'];
        this.handles = {};
        handles.forEach(pos => {
            const h = document.createElement('div');
            h.className = `calib-handle calib-handle-${pos}`;
            h.dataset.pos = pos;
            this.box.appendChild(h);
            this.handles[pos] = h;
            this._setupResize(h, pos);
        });

        this.el.appendChild(this.box);
        canvasArea.appendChild(this.el);
        
        this._setupDrag(this.box);
    }
    
    activate(heightU) {
        this.active = true;
        this.heightU = heightU;
        this.el.classList.remove('hidden');
        
        // Reset bounds if not set or just enforce aspect
        this._calcAspect();
        // center the box
        this.bounds.x = (1 - this.bounds.w) / 2;
        this.bounds.y = (1 - this.bounds.h) / 2;
        
        this._update();
    }
    
    deactivate() {
        this.active = false;
        this.el.classList.add('hidden');
    }
    
    toggle(heightU) {
        if (this.active) {
            this.deactivate();
        } else {
            this.activate(heightU);
        }
        return this.active;
    }
    
    updateHeightU(heightU) {
        this.heightU = heightU;
        if (this.active) {
            this._calcAspect();
            this._update();
        }
    }
    
    _calcAspect() {
        // Target aspect inside the physical world: RACK_WIDTH_INCHES / (heightU * U_HEIGHT_INCHES)
        const targetAspect = RACK_WIDTH_INCHES / (this.heightU * U_HEIGHT_INCHES);
        
        // Real image aspect ratio
        const imgAspect = this.imageCanvas.width / this.imageCanvas.height;
        
        // To maintain targetAspect visually in the scaled canvas:
        // this.bounds.w * imgW / (this.bounds.h * imgH) = targetAspect
        // this.bounds.w / this.bounds.h = targetAspect / imgAspect
        
        this.bounds.h = this.bounds.w / (targetAspect / imgAspect);
        
        if (this.bounds.h > 0.9) {
            this.bounds.h = 0.9;
            this.bounds.w = this.bounds.h * (targetAspect / imgAspect);
        }
    }
    
    _update() {
        const rect = this.imageCanvas.getBoundingClientRect();
        const areaRect = this.canvasArea.getBoundingClientRect();
        const offsetX = rect.left - areaRect.left;
        const offsetY = rect.top - areaRect.top;
        
        const left = offsetX + this.bounds.x * rect.width;
        const top = offsetY + this.bounds.y * rect.height;
        const width = this.bounds.w * rect.width;
        const height = this.bounds.h * rect.height;
        
        this.box.style.left = `${left}px`;
        this.box.style.top = `${top}px`;
        this.box.style.width = `${width}px`;
        this.box.style.height = `${height}px`;
        
        this.label.textContent = `${this.heightU}U Rails Area`;
    }
    
    _setupDrag(box) {
        let sx, sy, startBx, startBy;
        
        const onDown = (e) => {
            if (e.target.classList.contains('calib-handle')) return; // handled by resize
            e.preventDefault();
            sx = e.clientX;
            sy = e.clientY;
            startBx = this.bounds.x;
            startBy = this.bounds.y;
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
            box.classList.add('dragging');
        };
        
        const onMove = (e) => {
            const rect = this.imageCanvas.getBoundingClientRect();
            const dx = (e.clientX - sx) / rect.width;
            const dy = (e.clientY - sy) / rect.height;
            
            this.bounds.x = startBx + dx;
            this.bounds.y = startBy + dy;
            
            this.bounds.x = Math.max(0, Math.min(1 - this.bounds.w, this.bounds.x));
            this.bounds.y = Math.max(0, Math.min(1 - this.bounds.h, this.bounds.y));
            
            this._update();
        };
        
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            box.classList.remove('dragging');
        };
        
        box.addEventListener('pointerdown', onDown);
    }
    
    _setupResize(handle, pos) {
        let sx, sy, startBx, startBy, startBw, startBh;
        
        const targetAspect = () => {
            const a = RACK_WIDTH_INCHES / (this.heightU * U_HEIGHT_INCHES);
            const imgAspect = this.imageCanvas.width / this.imageCanvas.height;
            return a / imgAspect;
        };
        
        const onDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            sx = e.clientX;
            sy = e.clientY;
            startBx = this.bounds.x;
            startBy = this.bounds.y;
            startBw = this.bounds.w;
            startBh = this.bounds.h;
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        };
        
        const onMove = (e) => {
            const rect = this.imageCanvas.getBoundingClientRect();
            const dx = (e.clientX - sx) / rect.width;
            
            let aspect = targetAspect();
            let newW = startBw;
            let newX = startBx;
            let newY = startBy;
            let newH = startBh;
            
            if (pos.includes('e')) {
                newW = startBw + dx;
            } else if (pos.includes('w')) {
                newW = startBw - dx;
                newX = startBx + dx;
            }
            
            // Constrain minimum size
            newW = Math.max(0.1, newW);
            newH = newW / aspect;
            
            if (pos.includes('w')) {
                newX = startBx + startBw - newW; // correct x
            }
            
            if (pos.includes('n')) {
                newY = startBy + startBh - newH;
            }
            
            // Ensure bounds
            if (newX >= 0 && newY >= 0 && newX + newW <= 1 && newY + newH <= 1) {
                this.bounds.x = newX;
                this.bounds.y = newY;
                this.bounds.w = newW;
                this.bounds.h = newH;
                this._update();
            }
        };
        
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };
        
        handle.addEventListener('pointerdown', onDown);
    }

    getCalibrationData() {
        return {
            x: this.bounds.x,
            y: this.bounds.y,
            w: this.bounds.w,
            h: this.bounds.h
        };
    }
}

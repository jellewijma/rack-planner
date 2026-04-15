/**
 * Drag — Drag-and-drop engine for canvas items.
 */

export class DragManager {
    constructor(canvas, items) {
        this.canvas = canvas;
        this.items = items; // Map<id, itemObj>
        this.selectedId = null;
        this.isDragging = false;
        this.dragItem = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.onSelect = null;
        this.onDeselect = null;
        this.onDragEnd = null;
        this.onDragMove = null;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        this.canvas.canvas.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
    }

    _onPointerDown(e) {
        if (e.button !== 0) return;

        const target = e.target.closest('.canvas-item, .rack-equipment');
        if (!target) {
            this.deselect();
            return;
        }

        const itemId = target.dataset.itemId;
        if (!itemId) return;

        const item = this.items.get(itemId);
        if (!item) return;

        e.stopPropagation();
        e.preventDefault();

        this.select(itemId);

        // Start drag
        this.isDragging = true;
        this.dragItem = item;
        this.canvas.viewport.classList.add('is-dragging-item');

        const canvasPos = this.canvas.screenToCanvas(e.clientX, e.clientY);

        if (item.parentRack) {
            // Equipment inside rack → use its rack-relative position
            const rackItem = this.items.get(item.parentRack);
            if (rackItem) {
                this.dragOffsetX = canvasPos.x - rackItem.x;
                this.dragOffsetY = canvasPos.y - rackItem.y;
            }
        } else {
            this.dragOffsetX = canvasPos.x - item.x;
            this.dragOffsetY = canvasPos.y - item.y;
        }

        target.classList.add('is-dragging');
    }

    _onPointerMove(e) {
        if (!this.isDragging || !this.dragItem) return;

        const canvasPos = this.canvas.screenToCanvas(e.clientX, e.clientY);
        let newX = canvasPos.x - this.dragOffsetX;
        let newY = canvasPos.y - this.dragOffsetY;

        newX = this.canvas.snapToGrid(newX);
        newY = this.canvas.snapToGrid(newY);

        // If item was in a rack, pull it out first
        if (this.dragItem.parentRack) {
            if (this.onDragMove) {
                this.onDragMove(this.dragItem, newX, newY, 'pulling-from-rack');
            }
            return;
        }

        this.dragItem.x = newX;
        this.dragItem.y = newY;
        this.dragItem.el.style.left = `${newX}px`;
        this.dragItem.el.style.top = `${newY}px`;

        if (this.onDragMove) {
            this.onDragMove(this.dragItem, newX, newY, 'moving');
        }
    }

    _onPointerUp(e) {
        if (!this.isDragging) return;

        if (this.dragItem) {
            this.dragItem.el.classList.remove('is-dragging');
        }

        this.canvas.viewport.classList.remove('is-dragging-item');
        this.isDragging = false;

        if (this.onDragEnd && this.dragItem) {
            const canvasPos = this.canvas.screenToCanvas(e.clientX, e.clientY);
            this.onDragEnd(this.dragItem, canvasPos.x, canvasPos.y);
        }

        this.dragItem = null;
    }

    select(itemId) {
        if (this.selectedId === itemId) return;
        this.deselect();
        this.selectedId = itemId;
        const item = this.items.get(itemId);
        if (item) {
            item.el.classList.add('selected');
            if (this.onSelect) this.onSelect(item);
        }
    }

    deselect() {
        if (this.selectedId) {
            const item = this.items.get(this.selectedId);
            if (item) {
                item.el.classList.remove('selected');
            }
            this.selectedId = null;
            if (this.onDeselect) this.onDeselect();
        }
    }

    getSelectedItem() {
        return this.selectedId ? this.items.get(this.selectedId) : null;
    }
}

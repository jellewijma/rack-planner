/**
 * Storage — Save/Load/Export canvas state.
 */

const STORAGE_KEY = 'rackplanner-state';

export function saveState(items, canvasState) {
    const data = {
        version: 1,
        timestamp: Date.now(),
        canvas: canvasState,
        items: serializeItems(items),
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Failed to save state:', e);
        return false;
    }
}

export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to load state:', e);
        return null;
    }
}

export function clearState() {
    localStorage.removeItem(STORAGE_KEY);
}

function serializeItems(items) {
    const serialized = [];
    items.forEach((item, id) => {
        serialized.push({
            id,
            type: item.el.dataset.type,
            data: item.data,
            x: item.x,
            y: item.y,
            parentRack: item.parentRack || null,
            slotIndex: item.slotIndex != null ? item.slotIndex : null,
            slots: item.slots || null,
        });
    });
    return serialized;
}

/**
 * Export canvas as a PNG data-URL using native canvas rendering.
 */
export async function exportAsPng(viewportEl) {
    // Use html2canvas-style approach with native canvas
    const canvasEl = viewportEl.querySelector('#canvas');
    if (!canvasEl) return null;

    // Find bounding box of all items
    const items = canvasEl.querySelectorAll('.canvas-item');
    if (items.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(item => {
        const x = parseInt(item.style.left) || 0;
        const y = parseInt(item.style.top) || 0;
        const w = item.offsetWidth;
        const h = item.offsetHeight;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    });

    const padding = 40;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Use the browser's built-in serialization
    try {
        const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
        const canvas = await html2canvas(canvasEl, {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            backgroundColor: '#0c0c10',
            scale: 2,
        });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error('Export failed:', e);
        return null;
    }
}

export function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

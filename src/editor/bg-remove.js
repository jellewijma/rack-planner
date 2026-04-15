/**
 * bg-remove.js — Client-side background removal using canvas flood-fill.
 * Samples corner pixels to detect background color and replaces
 * near-matching pixels with transparency.
 */

/**
 * Auto-remove background by sampling corners.
 * @param {HTMLCanvasElement} canvas
 * @param {number} tolerance - Color distance threshold (0-255)
 */
export function autoRemoveBackground(canvas, tolerance = 30) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    // Sample corner pixels to determine background color
    const corners = [
        getPixel(data, 0, 0, w),              // top-left
        getPixel(data, w - 1, 0, w),           // top-right
        getPixel(data, 0, h - 1, w),           // bottom-left
        getPixel(data, w - 1, h - 1, w),       // bottom-right
        getPixel(data, Math.floor(w / 2), 0, w), // top-center
    ];

    // Average the corner colors
    const bgColor = averageColors(corners);

    // Flood-fill from all edges
    const visited = new Uint8Array(w * h);

    // Start flood from border pixels
    const queue = [];
    for (let x = 0; x < w; x++) {
        queue.push(x); queue.push(0);           // top edge
        queue.push(x); queue.push(h - 1);       // bottom edge
    }
    for (let y = 0; y < h; y++) {
        queue.push(0); queue.push(y);           // left edge
        queue.push(w - 1); queue.push(y);       // right edge
    }

    let i = 0;
    while (i < queue.length) {
        const x = queue[i++];
        const y = queue[i++];

        if (x < 0 || x >= w || y < 0 || y >= h) continue;

        const idx = y * w + x;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const pixel = getPixel(data, x, y, w);
        const dist = colorDistance(pixel, bgColor);

        if (dist <= tolerance) {
            // Make transparent
            const pi = idx * 4;
            data[pi + 3] = 0; // Set alpha to 0

            // Continue flood in 4 directions
            queue.push(x - 1, y);
            queue.push(x + 1, y);
            queue.push(x, y - 1);
            queue.push(x, y + 1);
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

/**
 * Remove a specific color at a clicked point (with flood).
 * @param {HTMLCanvasElement} canvas
 * @param {number} clickX - Click X on canvas
 * @param {number} clickY - Click Y on canvas
 * @param {number} tolerance
 */
export function removeColorAtPoint(canvas, clickX, clickY, tolerance = 30) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    const x = Math.round(clickX);
    const y = Math.round(clickY);

    if (x < 0 || x >= w || y < 0 || y >= h) return;

    const targetColor = getPixel(data, x, y, w);

    // If pixel is already transparent, skip
    if (targetColor[3] === 0) return;

    const visited = new Uint8Array(w * h);
    const queue = [x, y];

    let i = 0;
    while (i < queue.length) {
        const cx = queue[i++];
        const cy = queue[i++];

        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

        const idx = cy * w + cx;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const pixel = getPixel(data, cx, cy, w);
        const dist = colorDistance(pixel, targetColor);

        if (dist <= tolerance && pixel[3] > 0) {
            const pi = idx * 4;
            data[pi + 3] = 0;

            queue.push(cx - 1, cy);
            queue.push(cx + 1, cy);
            queue.push(cx, cy - 1);
            queue.push(cx, cy + 1);
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

/**
 * Load an image file onto a canvas.
 * @param {File} file
 * @param {HTMLCanvasElement} canvas
 * @param {number} maxWidth
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageToCanvas(file, canvas, maxWidth = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width;
                let h = img.height;

                if (w > maxWidth) {
                    h = (h / w) * maxWidth;
                    w = maxWidth;
                }

                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, w, h);

                resolve(img);
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Get the data URL from a canvas.
 */
export function getCanvasDataUrl(canvas) {
    return canvas.toDataURL('image/png');
}

// ─── Helpers ────────────────────────────────────────────

function getPixel(data, x, y, w) {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function colorDistance(a, b) {
    return Math.sqrt(
        (a[0] - b[0]) ** 2 +
        (a[1] - b[1]) ** 2 +
        (a[2] - b[2]) ** 2
    );
}

function averageColors(colors) {
    const count = colors.length;
    const sum = [0, 0, 0, 0];
    for (const c of colors) {
        sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2]; sum[3] += c[3];
    }
    return sum.map(v => Math.round(v / count));
}

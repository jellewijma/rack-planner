/**
 * mounting.js — Rack mounting hardware overlay.
 * Draws rack ears, screw holes, and U-height guides
 * over the equipment image to verify alignment.
 */

// Standard 19" rack dimensions (proportional)
const RACK_WIDTH_INCHES = 19;
const RACK_EAR_WIDTH_INCHES = 0.625; // Each ear ~5/8"
const RACK_PANEL_WIDTH_INCHES = 17.75; // Usable panel width
const U_HEIGHT_INCHES = 1.75;
const SCREW_SPACING_INCHES = [0.25, 0.625, 1.25]; // Standard EIA hole pattern per U

/**
 * Draw the mounting overlay on a canvas.
 * @param {HTMLCanvasElement} overlayCanvas - The overlay canvas
 * @param {number} imageWidth - Width of the equipment image
 * @param {number} imageHeight - Height of the equipment image
 * @param {number} heightU - Equipment height in U
 */
export function drawMountingOverlay(overlayCanvas, imageWidth, imageHeight, heightU) {
    overlayCanvas.width = imageWidth;
    overlayCanvas.height = imageHeight;
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, imageWidth, imageHeight);

    const totalHeightInches = heightU * U_HEIGHT_INCHES;
    const pixelsPerInchX = imageWidth / RACK_WIDTH_INCHES;
    const pixelsPerInchY = imageHeight / totalHeightInches;

    const earWidthPx = RACK_EAR_WIDTH_INCHES * pixelsPerInchX;
    const panelStartX = earWidthPx;
    const panelEndX = imageWidth - earWidthPx;

    // Draw rack ears (semi-transparent)
    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.fillRect(0, 0, earWidthPx, imageHeight);                // Left ear
    ctx.fillRect(panelEndX, 0, earWidthPx, imageHeight);        // Right ear

    // Ear borders
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    // Left ear border
    ctx.beginPath();
    ctx.moveTo(earWidthPx, 0);
    ctx.lineTo(earWidthPx, imageHeight);
    ctx.stroke();

    // Right ear border
    ctx.beginPath();
    ctx.moveTo(panelEndX, 0);
    ctx.lineTo(panelEndX, imageHeight);
    ctx.stroke();

    ctx.setLineDash([]);

    // Draw screw holes on ears
    const screwRadius = Math.max(3, pixelsPerInchX * 0.15);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.lineWidth = 1.5;

    for (let u = 0; u < heightU; u++) {
        const uTopY = u * U_HEIGHT_INCHES * pixelsPerInchY;

        // Standard EIA hole pattern: 3 holes per U
        for (const offset of SCREW_SPACING_INCHES) {
            const holeY = uTopY + offset * pixelsPerInchY;

            // Left ear screws
            drawScrewHole(ctx, earWidthPx / 2, holeY, screwRadius);

            // Right ear screws
            drawScrewHole(ctx, panelEndX + earWidthPx / 2, holeY, screwRadius);
        }
    }

    // Draw U-height division lines
    if (heightU > 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        for (let u = 1; u < heightU; u++) {
            const y = u * U_HEIGHT_INCHES * pixelsPerInchY;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(imageWidth, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    // U labels
    ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.font = `${Math.max(10, pixelsPerInchY * 0.3)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let u = 0; u < heightU; u++) {
        const centerY = (u + 0.5) * U_HEIGHT_INCHES * pixelsPerInchY;
        ctx.fillText(`${u + 1}U`, earWidthPx / 2, centerY);
    }
}

/**
 * Clear the mounting overlay.
 */
export function clearMountingOverlay(overlayCanvas) {
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ─── Helpers ────────────────────────────────────────────

function drawScrewHole(ctx, x, y, radius) {
    // Outer circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

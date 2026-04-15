/**
 * editor-main.js — Equipment Editor entry point.
 * Wires together bg-remove, mounting, and io-manager modules.
 */

import './styles/global.css';
import './styles/editor.css';

import { autoRemoveBackground, removeColorAtPoint, loadImageToCanvas, getCanvasDataUrl } from './editor/bg-remove.js';
import { drawMountingOverlay, clearMountingOverlay } from './editor/mounting.js';
import { IOManager } from './editor/io-manager.js';
import { loadUploadedEquipment, saveUploadedEquipment } from './upload.js';

// ─── DOM References ─────────────────────────────────────
const frontCanvasArea = document.getElementById('front-canvas-area');
const frontDropzone = document.getElementById('front-dropzone');
const frontFileInput = document.getElementById('front-file-input');
const frontCanvas = document.getElementById('front-canvas');
const mountingCanvas = document.getElementById('mounting-overlay-canvas');

const backCanvasArea = document.getElementById('back-canvas-area');
const backDropzone = document.getElementById('back-dropzone');
const backFileInput = document.getElementById('back-file-input');
const backCanvas = document.getElementById('back-canvas');

const btnRemoveBg = document.getElementById('btn-remove-bg');
const btnPickBg = document.getElementById('btn-pick-bg');
const btnResetFront = document.getElementById('btn-reset-front');
const btnToggleMounting = document.getElementById('btn-toggle-mounting');
const toleranceSlider = document.getElementById('bg-tolerance');
const toleranceValue = document.getElementById('tolerance-value');

const btnRemoveBgBack = document.getElementById('btn-remove-bg-back');
const btnResetBack = document.getElementById('btn-reset-back');

const btnSave = document.getElementById('btn-save-equipment');
const processingOverlay = document.getElementById('processing-overlay');
const processingText = document.getElementById('processing-text');
const toastEl = document.getElementById('editor-toast');

// ─── State ──────────────────────────────────────────────
let frontOriginalImage = null;
let backOriginalImage = null;
let colorPickMode = false;
let mountingVisible = false;

// ─── I/O Manager ────────────────────────────────────────
const ioManager = new IOManager(
    document.getElementById('inputs-list'),
    document.getElementById('outputs-list'),
    document.getElementById('btn-add-input'),
    document.getElementById('btn-add-output')
);

// ─── Power toggle ───────────────────────────────────────
const powerCheckbox = document.getElementById('eq-power-required');
const powerFields = document.getElementById('power-fields');

powerCheckbox.addEventListener('change', () => {
    powerFields.classList.toggle('disabled', !powerCheckbox.checked);
});

// ─── Tolerance slider ───────────────────────────────────
toleranceSlider.addEventListener('input', () => {
    toleranceValue.textContent = toleranceSlider.value;
});

// ─── Front Panel Upload ─────────────────────────────────
function setupDropzone(dropzone, fileInput, onFile) {
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
    });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) onFile(file);
    });
}

setupDropzone(frontDropzone, frontFileInput, async (file) => {
    showProcessing('Loading front panel image...');
    try {
        frontOriginalImage = file;
        await loadImageToCanvas(file, frontCanvas);
        frontCanvas.style.display = 'block';
        frontDropzone.classList.add('hidden');
        frontCanvasArea.classList.add('has-image');

        // Enable tools
        btnRemoveBg.disabled = false;
        btnPickBg.disabled = false;
        btnResetFront.disabled = false;
        btnToggleMounting.disabled = false;

        // Update mounting if visible
        if (mountingVisible) {
            updateMounting();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
    hideProcessing();
});

setupDropzone(backDropzone, backFileInput, async (file) => {
    showProcessing('Loading back panel image...');
    try {
        backOriginalImage = file;
        await loadImageToCanvas(file, backCanvas);
        backCanvas.style.display = 'block';
        backDropzone.classList.add('hidden');
        backCanvasArea.classList.add('has-image');

        btnRemoveBgBack.disabled = false;
        btnResetBack.disabled = false;
    } catch (err) {
        showToast(err.message, 'error');
    }
    hideProcessing();
});

// ─── Background Removal ─────────────────────────────────
btnRemoveBg.addEventListener('click', () => {
    showProcessing('Removing background...');
    // Use requestAnimationFrame to let the overlay render first
    requestAnimationFrame(() => {
        setTimeout(() => {
            autoRemoveBackground(frontCanvas, parseInt(toleranceSlider.value, 10));
            hideProcessing();
            showToast('Background removed');
        }, 50);
    });
});

btnRemoveBgBack.addEventListener('click', () => {
    showProcessing('Removing background...');
    requestAnimationFrame(() => {
        setTimeout(() => {
            autoRemoveBackground(backCanvas, parseInt(toleranceSlider.value, 10));
            hideProcessing();
            showToast('Background removed');
        }, 50);
    });
});

// ─── Color Pick Mode ────────────────────────────────────
btnPickBg.addEventListener('click', () => {
    colorPickMode = !colorPickMode;
    btnPickBg.classList.toggle('active', colorPickMode);
    frontCanvas.style.cursor = colorPickMode ? 'crosshair' : 'default';
});

frontCanvas.addEventListener('click', (e) => {
    if (!colorPickMode) return;

    const rect = frontCanvas.getBoundingClientRect();
    const scaleX = frontCanvas.width / rect.width;
    const scaleY = frontCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    showProcessing('Removing color...');
    requestAnimationFrame(() => {
        setTimeout(() => {
            removeColorAtPoint(frontCanvas, x, y, parseInt(toleranceSlider.value, 10));
            hideProcessing();
        }, 50);
    });
});

// ─── Reset ──────────────────────────────────────────────
btnResetFront.addEventListener('click', async () => {
    if (frontOriginalImage) {
        await loadImageToCanvas(frontOriginalImage, frontCanvas);
        showToast('Image reset to original');
    }
});

btnResetBack.addEventListener('click', async () => {
    if (backOriginalImage) {
        await loadImageToCanvas(backOriginalImage, backCanvas);
        showToast('Image reset to original');
    }
});

// ─── Mounting Overlay ───────────────────────────────────
btnToggleMounting.addEventListener('click', () => {
    mountingVisible = !mountingVisible;
    btnToggleMounting.classList.toggle('active', mountingVisible);

    if (mountingVisible) {
        updateMounting();
        mountingCanvas.classList.remove('hidden');
    } else {
        mountingCanvas.classList.add('hidden');
        clearMountingOverlay(mountingCanvas);
    }
});

function updateMounting() {
    const heightU = parseInt(document.getElementById('eq-height').value, 10) || 1;
    drawMountingOverlay(mountingCanvas, frontCanvas.width, frontCanvas.height, heightU);
}

// Re-draw mounting when height changes
document.getElementById('eq-height').addEventListener('change', () => {
    if (mountingVisible) updateMounting();
});

// ─── Save to Catalog ────────────────────────────────────
btnSave.addEventListener('click', () => {
    const name = document.getElementById('eq-name').value.trim();
    const brand = document.getElementById('eq-brand').value.trim();

    if (!name) { showToast('Please enter an equipment name', 'error'); return; }
    if (!brand) { showToast('Please enter a brand name', 'error'); return; }

    const category = document.getElementById('eq-category').value;
    const heightU = parseInt(document.getElementById('eq-height').value, 10);
    const description = document.getElementById('eq-description').value.trim();

    // Power data
    const powerRequired = powerCheckbox.checked;
    const power = powerRequired ? {
        required: true,
        watts: parseInt(document.getElementById('eq-power-watts').value, 10) || 0,
        connector: document.getElementById('eq-power-connector').value,
    } : { required: false };

    // I/O data
    const io = ioManager.getData();

    // Image data
    const frontImageDataUrl = frontCanvas.style.display !== 'none' ? getCanvasDataUrl(frontCanvas) : null;
    const backImageDataUrl = backCanvas.style.display !== 'none' ? getCanvasDataUrl(backCanvas) : null;

    // Build color from category
    const categoryColors = {
        effects: '#2d1f4e', power: '#1a1a2e', amplifier: '#1a2440',
        wireless: '#333340', mixer: '#2a2a40', interface: '#4a1a1a',
        networking: '#1a3a2e', other: '#2a2a2a'
    };

    const id = `upload-${brand.toLowerCase().replace(/\s+/g, '-')}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const eqData = {
        id,
        name,
        brand,
        category,
        heightU,
        color: categoryColors[category] || '#2a2a40',
        description: description || `${category} equipment`,
        image: null,
        imageDataUrl: frontImageDataUrl,
        backImageDataUrl,
        power,
        io,
        isUploaded: true,
    };

    // Save to localStorage
    const saved = loadUploadedEquipment();
    saved.push(eqData);
    saveUploadedEquipment(saved);

    showToast(`${brand} ${name} saved to catalog!`, 'success');

    // Redirect to planner after a short delay
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1200);
});

// ─── Utilities ──────────────────────────────────────────
function showProcessing(text) {
    processingText.textContent = text || 'Processing...';
    processingOverlay.classList.remove('hidden');
}

function hideProcessing() {
    processingOverlay.classList.add('hidden');
}

let toastTimer = null;
function showToast(msg, type = '') {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.className = `editor-toast ${type}`;
    toastTimer = setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 3000);
}

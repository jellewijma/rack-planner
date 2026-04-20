/**
 * rack-editor-main.js — Custom Rack Editor entry point.
 */

import './styles/global.css';
import './styles/editor.css';

import { autoRemoveBackground, removeColorAtPoint, loadImageToCanvas, getCanvasDataUrl } from './editor/bg-remove.js';
import { CropTool } from './editor/crop.js';
import { RackCalibrationTool } from './editor/rack-calibration.js';
import { loadUploadedEquipment, saveUploadedEquipment } from './upload.js';

// ─── DOM References ─────────────────────────────────────
const frontCanvasArea = document.getElementById('front-canvas-area');
const frontDropzone = document.getElementById('front-dropzone');
const frontFileInput = document.getElementById('front-file-input');
const frontCanvas = document.getElementById('front-canvas');

const btnRemoveBg = document.getElementById('btn-remove-bg');
const btnPickBg = document.getElementById('btn-pick-bg');
const btnCrop = document.getElementById('btn-crop');
const btnResetFront = document.getElementById('btn-reset-front');
const btnCalibrate = document.getElementById('btn-calibrate');
const toleranceSlider = document.getElementById('bg-tolerance');
const toleranceValue = document.getElementById('tolerance-value');

const btnSave = document.getElementById('btn-save-rack');
const processingOverlay = document.getElementById('processing-overlay');
const processingText = document.getElementById('processing-text');
const toastEl = document.getElementById('editor-toast');

const heightSelect = document.getElementById('eq-height');

// ─── State ──────────────────────────────────────────────
let frontOriginalImage = null;
let colorPickMode = false;

// ─── Calibration Tool ───────────────────────────────────
const calibrator = new RackCalibrationTool(frontCanvasArea, frontCanvas);

// ─── Crop Tool ──────────────────────────────────────────
const cropTool = new CropTool(frontCanvas, frontCanvasArea, {
    onCropApplied: () => {
        showToast('Image cropped');
        if (calibrator.active) {
            calibrator.deactivate();
            calibrator.activate(parseInt(heightSelect.value, 10));
        }
    }
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
    if (!file.type.startsWith('image/')) {
        showToast('Please upload a valid image file.', 'error');
        return;
    }
    showProcessing('Loading rack image...');
    try {
        frontOriginalImage = file;
        await loadImageToCanvas(file, frontCanvas);
        frontCanvas.style.display = 'block';
        frontDropzone.classList.add('hidden');
        frontCanvasArea.classList.add('has-image');

        // Enable tools
        btnRemoveBg.disabled = false;
        btnPickBg.disabled = false;
        btnCrop.disabled = false;
        btnResetFront.disabled = false;
        btnCalibrate.disabled = false;
    } catch (err) {
        showToast(err.message, 'error');
    }
    hideProcessing();
});

// ─── Background Removal ─────────────────────────────────
btnRemoveBg.addEventListener('click', () => {
    showProcessing('Removing background...');
    requestAnimationFrame(() => {
        setTimeout(() => {
            autoRemoveBackground(frontCanvas, parseInt(toleranceSlider.value, 10));
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

// ─── Crop ───────────────────────────────────────────────
btnCrop.addEventListener('click', () => {
    if (cropTool.active) {
        cropTool.deactivate();
        btnCrop.classList.remove('active');
    } else {
        if (colorPickMode) {
            colorPickMode = false;
            btnPickBg.classList.remove('active');
            frontCanvas.style.cursor = 'default';
        }
        if (calibrator.active) {
            calibrator.deactivate();
            btnCalibrate.classList.remove('active');
        }
        cropTool.activate();
        btnCrop.classList.add('active');
    }
});

// ─── Rails Calibration ──────────────────────────────────
btnCalibrate.addEventListener('click', () => {
    if (cropTool.active) {
        cropTool.deactivate();
        btnCrop.classList.remove('active');
    }
    if (colorPickMode) {
        colorPickMode = false;
        btnPickBg.classList.remove('active');
        frontCanvas.style.cursor = 'default';
    }

    const nowActive = calibrator.toggle(parseInt(heightSelect.value, 10));
    btnCalibrate.classList.toggle('active', nowActive);
    
    if (nowActive) {
        showToast('Drag corners to align rails to the image.');
    }
});

heightSelect.addEventListener('change', () => {
    calibrator.updateHeightU(parseInt(heightSelect.value, 10));
});

// ─── Reset ──────────────────────────────────────────────
btnResetFront.addEventListener('click', async () => {
    if (frontOriginalImage) {
        cropTool.deactivate();
        calibrator.deactivate();
        btnCrop.classList.remove('active');
        btnCalibrate.classList.remove('active');
        await loadImageToCanvas(frontOriginalImage, frontCanvas);
        showToast('Image reset to original');
    }
});

// ─── Save to Catalog ────────────────────────────────────
btnSave.addEventListener('click', () => {
    const name = document.getElementById('eq-name').value.trim();
    const brand = document.getElementById('eq-brand').value.trim();

    if (!name) { showToast('Please enter a rank name/model', 'error'); return; }
    if (!brand) { showToast('Please enter a brand name', 'error'); return; }
    if (!calibrator.active) { showToast('Please place rack rails! Click "Place Rack Rails" first.', 'error'); return; }

    const category = 'rack';
    const heightU = parseInt(heightSelect.value, 10);
    const description = document.getElementById('eq-description').value.trim();
    const calibration = calibrator.getCalibrationData();

    cropTool.deactivate();
    calibrator.deactivate();

    const imageDataUrl = frontCanvas.style.display !== 'none' ? getCanvasDataUrl(frontCanvas) : null;

    if (!imageDataUrl) {
        showToast('Please upload a rack image', 'error');
        return;
    }

    const id = `upload-rack-${brand.toLowerCase().replace(/\s+/g, '-')}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const eqData = {
        id,
        name,
        brand,
        category,
        heightU,
        color: '#1a1a1e',
        description: description || `Custom flightcase rack`,
        image: null,
        imageDataUrl,
        isUploaded: true,
        isUploadRack: true,
        calibration
    };

    const saved = loadUploadedEquipment();
    saved.push(eqData);
    saveUploadedEquipment(saved);

    showToast(`Custom rack ${brand} ${name} saved!`, 'success');

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

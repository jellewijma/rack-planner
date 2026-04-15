/**
 * upload.js — Client-side equipment image upload and processing.
 * Handles drag-and-drop, image resizing, and data URL generation.
 */

const MAX_IMAGE_WIDTH = 800;
const STORAGE_KEY = 'rack-planner-custom-equipment';

/**
 * Process an uploaded image file into a resized data URL.
 * @param {File} file - The image file
 * @returns {Promise<string>} - Data URL of the processed image
 */
export function processImage(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Invalid file type. Please upload an image.'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize to max width while maintaining aspect ratio
                let width = img.width;
                let height = img.height;

                if (width > MAX_IMAGE_WIDTH) {
                    height = (height / width) * MAX_IMAGE_WIDTH;
                    width = MAX_IMAGE_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw with high quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to data URL (PNG for transparency support)
                const dataUrl = canvas.toDataURL('image/png', 0.9);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error('Failed to load image.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
    });
}

/**
 * Create an equipment data object from upload form data.
 * @param {Object} params
 * @returns {Object} Equipment data object
 */
export function createEquipmentData({ name, brand, category, heightU, imageDataUrl }) {
    const id = `upload-${brand.toLowerCase().replace(/\s+/g, '-')}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    return {
        id,
        name,
        brand,
        category,
        heightU: parseInt(heightU, 10),
        color: getCategoryColor(category),
        description: `User-uploaded ${category} equipment`,
        image: null,               // Not a file path — we use imageDataUrl instead
        imageDataUrl,              // Base64 data URL for rendering
        isUploaded: true           // Flag for identifying user-uploaded items
    };
}

/**
 * Get a default color for a category.
 */
function getCategoryColor(category) {
    const colors = {
        effects: '#2d1f4e',
        power: '#1a1a2e',
        amplifier: '#1a2440',
        wireless: '#333340',
        mixer: '#2a2a40',
        interface: '#4a1a1a',
        other: '#2a2a2a'
    };
    return colors[category] || '#2a2a40';
}

/**
 * Save uploaded equipment to localStorage.
 */
export function saveUploadedEquipment(equipmentList) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(equipmentList));
    } catch (e) {
        console.warn('Failed to save uploaded equipment:', e);
    }
}

/**
 * Load uploaded equipment from localStorage.
 * @returns {Array} Array of equipment data objects
 */
export function loadUploadedEquipment() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn('Failed to load uploaded equipment:', e);
        return [];
    }
}

/**
 * Initialize the upload UI interactions.
 * @param {Object} callbacks - { onEquipmentAdded: (eqData) => void }
 */
export function initUploadUI(callbacks) {
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('upload-file');
    const preview = document.getElementById('upload-preview');
    const previewImg = document.getElementById('upload-preview-img');
    const previewRemove = document.getElementById('upload-preview-remove');
    const processing = document.getElementById('upload-processing');
    const btnAdd = document.getElementById('btn-upload-add');

    let currentFile = null;
    let processedDataUrl = null;

    // Drag events
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
        if (file) handleFileSelected(file);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileSelected(file);
    });

    // Remove preview
    previewRemove.addEventListener('click', () => {
        clearUpload();
    });

    // Add button
    btnAdd.addEventListener('click', async () => {
        const name = document.getElementById('upload-name').value.trim();
        const brand = document.getElementById('upload-brand').value.trim();
        const heightU = document.getElementById('upload-height').value;
        const category = document.getElementById('upload-category').value;

        if (!name) {
            callbacks.onError?.('Please enter an equipment name.');
            return;
        }
        if (!brand) {
            callbacks.onError?.('Please enter a brand name.');
            return;
        }

        // Process image if we have a file but haven't processed yet
        if (currentFile && !processedDataUrl) {
            processing.classList.add('active');
            try {
                processedDataUrl = await processImage(currentFile);
            } catch (err) {
                processing.classList.remove('active');
                callbacks.onError?.(err.message);
                return;
            }
            processing.classList.remove('active');
        }

        const eqData = createEquipmentData({
            name,
            brand,
            category,
            heightU,
            imageDataUrl: processedDataUrl
        });

        callbacks.onEquipmentAdded?.(eqData);
        clearUpload();
    });

    async function handleFileSelected(file) {
        currentFile = file;
        processedDataUrl = null;

        // Show processing
        processing.classList.add('active');
        dropzone.style.display = 'none';

        try {
            processedDataUrl = await processImage(file);
            previewImg.src = processedDataUrl;
            preview.classList.add('has-image');
        } catch (err) {
            callbacks.onError?.(err.message);
            dropzone.style.display = '';
        }

        processing.classList.remove('active');
    }

    function clearUpload() {
        currentFile = null;
        processedDataUrl = null;
        preview.classList.remove('has-image');
        previewImg.src = '';
        dropzone.style.display = '';
        fileInput.value = '';
        document.getElementById('upload-name').value = '';
        document.getElementById('upload-brand').value = '';
        document.getElementById('upload-height').value = '1';
        document.getElementById('upload-category').value = 'effects';
    }
}

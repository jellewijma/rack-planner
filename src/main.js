/**
 * RackPlanner — Main entry point.
 * Wires together Canvas, DragManager, Catalog, and Storage.
 */

import './styles/global.css';
import './styles/components.css';

import { Canvas } from './canvas.js';
import { DragManager } from './drag.js';
import { Catalog } from './catalog.js';
import {
    createRackElement,
    createEquipmentElement,
    insertIntoRack,
    removeFromRack,
    getSlotAtY,
    highlightSlots,
    canInsertIntoRack,
    findNearestAvailableSlot,
    SLOT_HEIGHT,
} from './rack.js';
import { saveState, loadState, clearState, exportAsPng, downloadDataUrl } from './storage.js';
import { loadUploadedEquipment } from './upload.js';
import equipmentData from './data/equipment.json';

// ─── State ──────────────────────────────────────────────
const items = new Map();   // id → item object
let autoSaveEnabled = true;
let autoSaveTimer = null;
const history = {
    undo: [],
    redo: [],
    max: 100,
    isApplying: false,
};

// ─── DOM ────────────────────────────────────────────────
const viewportEl = document.getElementById('canvas-viewport');
const canvasEl = document.getElementById('canvas');
const fabEl = document.getElementById('fab-add');
const sidebarEl = document.getElementById('sidebar');
const searchEl = document.getElementById('search-input');
const categoryTabsEl = document.getElementById('category-tabs');
const equipmentListEl = document.getElementById('equipment-list');
const zoomDisplay = document.getElementById('zoom-level');
const contextMenu = document.getElementById('context-menu');
const toastEl = document.getElementById('toast');

// ─── Canvas ─────────────────────────────────────────────
const canvas = new Canvas(viewportEl, canvasEl);
canvas.onZoomChange = (zoom) => {
    zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
};

// ─── Catalog ────────────────────────────────────────────
const catalog = new Catalog(equipmentData, equipmentListEl, searchEl, categoryTabsEl);

// Load previously uploaded equipment from localStorage
const uploadedEquipment = loadUploadedEquipment();
uploadedEquipment.forEach(eq => catalog.addEquipment(eq));

let catalogDragInfo = null;

catalog.onPointerDownItem = (itemData, e) => {
    catalogDragInfo = {
        itemData,
        startX: e.clientX,
        startY: e.clientY,
        dragStarted: false
    };

    const onUp = (upEvent) => {
        if (catalogDragInfo && !catalogDragInfo.dragStarted) {
            addItemToCanvas(catalogDragInfo.itemData);
            showToast(`Added ${catalogDragInfo.itemData.name}`);
            scheduleAutoSave();
        }
        catalogDragInfo = null;
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointermove', onMove);
    };

    const onMove = (moveEvent) => {
        if (!catalogDragInfo) return;
        if (catalogDragInfo.dragStarted) return;

        const dx = moveEvent.clientX - catalogDragInfo.startX;
        // For catalog items, we only want to trigger drag on horizontal movement
        // to allow native vertical scrolling on touch devices.
        if (Math.abs(dx) > 5) {
            catalogDragInfo.dragStarted = true;

            const canvasPos = canvas.screenToCanvas(moveEvent.clientX, moveEvent.clientY);
            const halfWidth = 170; 
            const halfHeight = (itemData.heightU * SLOT_HEIGHT) / 2;
            const posX = canvas.snapToGrid(canvasPos.x - halfWidth);
            const posY = canvas.snapToGrid(canvasPos.y - halfHeight);

            const newItem = addItemToCanvas(itemData, posX, posY);
            drag.startDrag(newItem, moveEvent.clientX, moveEvent.clientY);
            drag.dragStartX = null; // Mark as new item
        }
    };

    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
};

// ─── Drag Manager ───────────────────────────────────────
const drag = new DragManager(canvas, items);

drag.onSelect = (item) => {
    showContextMenu(item);
};

drag.onDeselect = () => {
    hideContextMenu();
};

drag.onDragMove = (item, x, y, mode) => {
    hideContextMenu();

    if (mode === 'pulling-from-rack' && item.parentRack) {
        // Pull equipment out of rack
        const rackItem = items.get(item.parentRack);
        if (rackItem) {
            removeFromRack(rackItem, item);
            updateRackCapacityBadge(rackItem);
            updateRackCapacityBadge(rackItem);

            // Convert to standalone
            item.el.className = 'canvas-item standalone-equipment is-dragging selected';
            item.el.style.width = '340px';
            item.el.style.height = `${item.data.heightU * SLOT_HEIGHT}px`;
            item.el.style.position = 'absolute';
            item.el.style.background = item.data.color || '#2a2a40';
            item.el.style.left = `${x}px`;
            item.el.style.top = `${y}px`;
            canvasEl.appendChild(item.el);
            item.x = x;
            item.y = y;
        }
    }

    // Check if hovering over a rack for drop-in preview
    if (item.el.dataset.type === 'equipment') {
        // Clear all rack highlights
        items.forEach(other => {
            if (other.el.dataset.type === 'rack') {
                highlightSlots(other, 0, other.data.heightU, false);
            }
        });

        // Check overlap with racks
        items.forEach(rackItem => {
            if (rackItem.el.dataset.type !== 'rack') return;
            const rackRect = {
                x: rackItem.x,
                y: rackItem.y,
                w: rackItem.el.offsetWidth,
                h: rackItem.el.offsetHeight,
            };
            const centerX = x + 170;
            const centerY = y + (item.data.heightU * SLOT_HEIGHT) / 2;

            if (
                centerX > rackRect.x && centerX < rackRect.x + rackRect.w &&
                centerY > rackRect.y && centerY < rackRect.y + rackRect.h
            ) {
                const localTopY = y - rackRect.y;
                let slotIdx = getSlotAtY(rackItem.el, localTopY);
                if (slotIdx >= 0) {
                    if (!canInsertIntoRack(rackItem, item.data.heightU, slotIdx)) {
                        slotIdx = findNearestAvailableSlot(rackItem, item.data.heightU, slotIdx);
                    }
                    if (slotIdx >= 0) {
                        highlightSlots(rackItem, slotIdx, item.data.heightU, true);
                    }
                }
            }
        });
    }
};

drag.onDragEnd = (item, cx, cy) => {
    // Clear all rack highlights
    items.forEach(other => {
        if (other.el.dataset.type === 'rack') {
            highlightSlots(other, 0, other.data.heightU, false);
        }
    });

    // Try to drop into a rack
    if (item.el.dataset.type === 'equipment' && !item.parentRack) {
        let placedInRack = false;
        let hoveredRack = false;

        items.forEach(rackItem => {
            if (rackItem.el.dataset.type !== 'rack') return;
            if (item.parentRack) return; // Already placed

            const rackRect = {
                x: rackItem.x,
                y: rackItem.y,
                w: rackItem.el.offsetWidth,
                h: rackItem.el.offsetHeight,
            };

            const centerX = item.x + 170;
            const centerY = item.y + (item.data.heightU * SLOT_HEIGHT) / 2;

            if (
                centerX > rackRect.x && centerX < rackRect.x + rackRect.w &&
                centerY > rackRect.y && centerY < rackRect.y + rackRect.h
            ) {
                hoveredRack = true;
                const localTopY = item.y - rackRect.y;
                let slotIdx = getSlotAtY(rackItem.el, localTopY);
                if (slotIdx >= 0) {
                    if (!canInsertIntoRack(rackItem, item.data.heightU, slotIdx)) {
                        slotIdx = findNearestAvailableSlot(rackItem, item.data.heightU, slotIdx);
                    }
                    if (slotIdx >= 0) {
                        const success = insertIntoRack(rackItem, item, slotIdx);
                        if (success) {
                            showToast(`${item.data.name} → Slot ${slotIdx + 1}`);
                            placedInRack = true;
                            updateRackCapacityBadge(rackItem);
                            const powerUsedW = rackItem.slots
                                .filter(Boolean)
                                .reduce((sum, eqId) => {
                                    const eq = items.get(eqId);
                                    return sum + (eq?.data?.power?.required ? (eq.data.power.watts || 0) : 0);
                                }, 0);
                            const powerCapacityW = rackItem.data.powerCapacityW || 2000;
                            if (powerUsedW > powerCapacityW) {
                                showToast(`⚠ ${rackItem.data.name} exceeds power budget (${powerUsedW}W/${powerCapacityW}W)`, 'error');
                            }
                        }
                    }
                }
            }
        });

        if (hoveredRack && !placedInRack) {
            showToast('No available slots, bouncing back', 'error');
            if (drag.dragStartRack && items.has(drag.dragStartRack)) {
                const originalRack = items.get(drag.dragStartRack);
                if (drag.dragStartSlot != null && canInsertIntoRack(originalRack, item.data.heightU, drag.dragStartSlot)) {
                    insertIntoRack(originalRack, item, drag.dragStartSlot);
                    updateRackCapacityBadge(originalRack);
                } else {
                    let slotIdx = findNearestAvailableSlot(originalRack, item.data.heightU, 0);
                    if (slotIdx >= 0) {
                        insertIntoRack(originalRack, item, slotIdx);
                        updateRackCapacityBadge(originalRack);
                    }
                }
            } else if (drag.dragStartX != null) {
                item.x = drag.dragStartX;
                item.y = drag.dragStartY;
                item.el.style.left = `${item.x}px`;
                item.el.style.top = `${item.y}px`;
            }
        }
    }

    // Show context menu for selected item
    const selectedItem = drag.getSelectedItem();
    if (selectedItem) {
        showContextMenu(selectedItem);
    }

    scheduleAutoSave();
};

// ─── Add item to canvas ─────────────────────────────────
function addItemToCanvas(itemData, x, y) {
    const center = canvas.getViewportCenter();
    const posX = x != null ? x : canvas.snapToGrid(center.x - 170);
    const posY = y != null ? y : canvas.snapToGrid(center.y - 50);

    let item;
    if (itemData.category === 'rack') {
        item = createRackElement(itemData, posX, posY);
    } else {
        item = createEquipmentElement(itemData, posX, posY);
    }

    items.set(item.id, item);
    canvasEl.appendChild(item.el);
    if (item.el.dataset.type === 'rack') {
        updateRackCapacityBadge(item);
    }
    return item;
}



function updateRackCapacityBadge(rackItem) {
    if (!rackItem || rackItem.el.dataset.type !== 'rack') return;
    const total = rackItem.data.heightU || rackItem.slots?.length || 0;
    const used = rackItem.slots ? rackItem.slots.filter(slot => slot !== null).length : 0;
    const free = Math.max(0, total - used);

    const metaEl = rackItem.el.querySelector('.rack-header-meta');
    if (!metaEl) return;

    metaEl.textContent = `${total}U · ${free}U free`;
    metaEl.classList.toggle('is-near-full', free <= 2);
    metaEl.classList.toggle('is-full', free === 0);
}

function refreshAllRackCapacityBadges() {
    items.forEach((item) => {
        if (item.el.dataset.type === 'rack') {
            updateRackCapacityBadge(item);
        }
    });
    refreshPowerDashboard();
}

function refreshPowerDashboard() {
    const equipment = [...items.values()].filter(item => item.el.dataset.type === 'equipment');
    const racks = [...items.values()].filter(item => item.el.dataset.type === 'rack');

    const totalPower = equipment.reduce((sum, eq) => sum + (eq.data?.power?.required ? (eq.data.power.watts || 0) : 0), 0);
    const unracked = equipment.filter(eq => !eq.parentRack).length;
    const overbudgetRacks = racks.filter((rack) => {
        const rackPower = (rack.slots || [])
            .filter(Boolean)
            .reduce((sum, eqId) => {
                const eq = items.get(eqId);
                return sum + (eq?.data?.power?.required ? (eq.data.power.watts || 0) : 0);
            }, 0);
        const capacity = rack.data.powerCapacityW || 2000;
        return rackPower > capacity;
    }).length;

    const totalEqEl = document.getElementById('dash-total-equipment');
    const totalPowerEl = document.getElementById('dash-total-power');
    const unrackedEl = document.getElementById('dash-unracked');
    const overbudgetEl = document.getElementById('dash-overbudget');
    if (!totalEqEl || !totalPowerEl || !unrackedEl || !overbudgetEl) return;

    totalEqEl.textContent = String(equipment.length);
    totalPowerEl.textContent = String(totalPower);
    unrackedEl.textContent = String(unracked);
    overbudgetEl.textContent = String(overbudgetRacks);
}
// ─── Duplicate item ─────────────────────────────────────
function duplicateItem(item) {
    pushHistorySnapshot();
    const newItem = addItemToCanvas(item.data, item.x + 30, item.y + 30);
    showToast(`Duplicated ${item.data.name}`);
    scheduleAutoSave();
    return newItem;
}

// ─── Delete item ────────────────────────────────────────
function deleteItem(item) {
    pushHistorySnapshot();
    // If it's a rack, remove all equipment inside it first
    if (item.el.dataset.type === 'rack' && item.slots) {
        const placed = new Set(item.slots.filter(s => s !== null));
        placed.forEach(eqId => {
            const eq = items.get(eqId);
            if (eq) {
                removeFromRack(item, eq);
                updateRackCapacityBadge(item);
                eq.el.remove();
                items.delete(eqId);
            }
        });
    }

    // If it's equipment in a rack, remove from rack
    if (item.parentRack) {
        const rackItem = items.get(item.parentRack);
        if (rackItem) {
            removeFromRack(rackItem, item);
            updateRackCapacityBadge(rackItem);
        }
    }

    item.el.remove();
    items.delete(item.id || item.el.dataset.itemId);
    drag.deselect();
    hideContextMenu();
    showToast(`Deleted ${item.data.name}`);
    scheduleAutoSave();
}

// ─── Context Menu ───────────────────────────────────────
function showContextMenu(item) {
    const { x: sx, y: sy } = canvas.canvasToScreen(
        item.parentRack ? items.get(item.parentRack).x + 170 : item.x + item.el.offsetWidth / 2,
        item.parentRack ? items.get(item.parentRack).y + (item.slotIndex * SLOT_HEIGHT) : item.y
    );

    contextMenu.style.left = `${sx - 36}px`;
    contextMenu.style.top = `${sy - 44}px`;
    contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
    contextMenu.classList.add('hidden');
}

// ─── Sidebar Toggle ─────────────────────────────────────
let sidebarOpen = false;
const isDesktop = () => window.innerWidth >= 1024;

function toggleSidebar() {
    if (isDesktop()) return; // Sidebar is always open on desktop
    sidebarOpen = !sidebarOpen;
    sidebarEl.classList.toggle('sidebar-open', sidebarOpen);
    sidebarEl.classList.toggle('sidebar-closed', !sidebarOpen);
    fabEl.classList.toggle('fab-active', sidebarOpen);
}

fabEl.addEventListener('click', toggleSidebar);

// Close sidebar when clicking canvas (mobile only)
viewportEl.addEventListener('pointerdown', (e) => {
    if (e.target === canvasEl && sidebarOpen && !isDesktop()) {
        toggleSidebar();
    }
});

// Auto-open sidebar on desktop
if (isDesktop()) {
    sidebarEl.classList.add('sidebar-open');
    sidebarEl.classList.remove('sidebar-closed');
    sidebarOpen = true;
}

// ─── Collapsible Sidebar Sections ────────────────────────
document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const section = e.currentTarget.closest('.collapsible-section');
        if (section) {
            section.classList.toggle('closed');
        }
    });
});




function csvEscape(value) {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
}

function exportBomCsv() {
    const equipment = [...items.values()].filter(item => item.el.dataset.type === 'equipment');
    if (equipment.length === 0) {
        showToast('No equipment to export', 'error');
        return;
    }

    const grouped = new Map();
    equipment.forEach((eq) => {
        const rackName = eq.parentRack && items.has(eq.parentRack)
            ? (items.get(eq.parentRack).data?.name || 'Rack')
            : 'Unracked';
        const slotLabel = eq.slotIndex != null ? `Slot ${eq.slotIndex + 1}` : '-';
        const key = `${eq.data.brand || 'Unknown'}::${eq.data.name || 'Unnamed'}::${eq.data.heightU || 0}::${rackName}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                brand: eq.data.brand || 'Unknown',
                name: eq.data.name || 'Unnamed',
                heightU: eq.data.heightU || 0,
                category: eq.data.category || '',
                watts: eq.data.power?.required ? (eq.data.power.watts || 0) : 0,
                rackName,
                slots: new Set(),
                qty: 0,
            });
        }
        const entry = grouped.get(key);
        entry.qty += 1;
        entry.slots.add(slotLabel);
    });

    const rows = [['Brand', 'Model', 'Qty', 'HeightU', 'Category', 'Rack', 'Slots', 'WattsEach', 'TotalWatts']];
    let grandTotalWatts = 0;
    [...grouped.values()]
        .sort((a, b) => a.rackName.localeCompare(b.rackName) || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
        .forEach((entry) => {
            const totalWatts = entry.watts * entry.qty;
            grandTotalWatts += totalWatts;
            rows.push([
                entry.brand,
                entry.name,
                entry.qty,
                entry.heightU,
                entry.category,
                entry.rackName,
                [...entry.slots].sort().join(' | '),
                entry.watts,
                totalWatts,
            ]);
        });

    rows.push([]);
    rows.push(['TOTAL', '', '', '', '', '', '', '', grandTotalWatts]);

    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `rack-bom-${new Date().toISOString().slice(0, 10)}.csv`);
    URL.revokeObjectURL(url);
    showToast('BOM exported as CSV', 'success');
}

// ─── Toolbar Actions ────────────────────────────────────
document.getElementById('btn-zoom-in').addEventListener('click', () => canvas.zoomIn());
document.getElementById('btn-zoom-out').addEventListener('click', () => canvas.zoomOut());

document.getElementById('btn-save').addEventListener('click', () => {
    if (saveState(items, canvas.getState())) {
        showToast('Layout saved!', 'success');
    } else {
        showToast('Failed to save', 'error');
    }
});

document.getElementById('btn-load').addEventListener('click', () => {
    const state = loadState();
    if (state) {
        pushHistorySnapshot();
        restoreState(state);
        showToast('Layout loaded!', 'success');
    } else {
        showToast('No saved layout found', 'error');
    }
});

document.getElementById('btn-export').addEventListener('click', async () => {
    showToast('Exporting...');
    const dataUrl = await exportAsPng(viewportEl);
    if (dataUrl) {
        downloadDataUrl(dataUrl, 'rack-layout.png');
        showToast('Exported as PNG!', 'success');
    } else {
        showToast('Export failed — add some items first', 'error');
    }
});

document.getElementById('btn-export-bom').addEventListener('click', exportBomCsv);

// Context menu actions
document.getElementById('ctx-duplicate').addEventListener('click', () => {
    const item = drag.getSelectedItem();
    if (item) duplicateItem(item);
});

document.getElementById('ctx-delete').addEventListener('click', () => {
    const item = drag.getSelectedItem();
    if (item) deleteItem(item);
});

// ─── Custom Items ───────────────────────────────────────
let customType = 'equipment';
const STARTER_TEMPLATES = {
    studio: {
        name: 'Studio Rack',
        items: [
            { name: 'Studio Rack', brand: 'Template', category: 'rack', heightU: 16, color: '#2e3440' },
            { name: 'Power Conditioner', brand: 'Template', category: 'power', heightU: 1, color: '#3b4252', power: { required: false } },
            { name: 'Audio Interface', brand: 'Template', category: 'interface', heightU: 1, color: '#5e81ac', power: { required: true, watts: 40 } },
            { name: 'Preamps', brand: 'Template', category: 'preamp', heightU: 2, color: '#4c566a', power: { required: true, watts: 60 } },
        ],
    },
    live: {
        name: 'Live Rack',
        items: [
            { name: 'Live Rack', brand: 'Template', category: 'rack', heightU: 20, color: '#2e3440' },
            { name: 'Power Conditioner', brand: 'Template', category: 'power', heightU: 1, color: '#3b4252', power: { required: false } },
            { name: 'Wireless Receivers', brand: 'Template', category: 'wireless', heightU: 2, color: '#bf616a', power: { required: true, watts: 75 } },
            { name: 'Digital Mixer Stagebox', brand: 'Template', category: 'mixer', heightU: 3, color: '#a3be8c', power: { required: true, watts: 120 } },
        ],
    },
};

document.getElementById('custom-tab-equipment').addEventListener('click', (e) => {
    customType = 'equipment';
    document.querySelectorAll('.custom-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
});

document.getElementById('custom-tab-rack').addEventListener('click', (e) => {
    customType = 'rack';
    document.querySelectorAll('.custom-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
});

document.getElementById('btn-add-custom').addEventListener('click', () => {
    pushHistorySnapshot();
    const name = document.getElementById('custom-name').value.trim() || 'Custom Item';
    const heightU = parseInt(document.getElementById('custom-height').value) || 1;
    const color = document.getElementById('custom-color').value;

    const customData = {
        id: `custom-${Date.now()}`,
        name,
        brand: 'Custom',
        category: customType,
        heightU: Math.max(1, Math.min(48, heightU)),
        color,
        description: `Custom ${customType} — ${heightU}U`,
    };

    addItemToCanvas(customData);
    showToast(`Added custom ${customType}: ${name}`);
    scheduleAutoSave();
});

function addStarterTemplate(templateKey) {
    const template = STARTER_TEMPLATES[templateKey];
    if (!template) return;
    pushHistorySnapshot();

    const center = canvas.getViewportCenter();
    const rackX = canvas.snapToGrid(center.x - 180);
    const rackY = canvas.snapToGrid(center.y - 140);
    const rackData = {
        id: `template-rack-${Date.now()}`,
        name: template.items[0].name,
        brand: template.items[0].brand,
        category: 'rack',
        heightU: template.items[0].heightU,
        color: template.items[0].color,
        description: `${template.name} starter`,
    };
    const rack = addItemToCanvas(rackData, rackX, rackY);

    let slotCursor = 0;
    template.items.slice(1).forEach((itemData) => {
        const eqData = {
            id: `template-eq-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
            ...itemData,
            description: `${template.name} starter`,
        };
        const eq = addItemToCanvas(eqData, rackX + 380, rackY + (slotCursor * SLOT_HEIGHT));
        const inserted = insertIntoRack(rack, eq, slotCursor);
        if (inserted) {
            slotCursor += eqData.heightU;
        }
    });

    updateRackCapacityBadge(rack);
    refreshPowerDashboard();
    showToast(`${template.name} template added`, 'success');
    scheduleAutoSave();
}

document.getElementById('btn-template-studio').addEventListener('click', () => addStarterTemplate('studio'));
document.getElementById('btn-template-live').addEventListener('click', () => addStarterTemplate('live'));

// ─── Clear Canvas ───────────────────────────────────────
document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (items.size === 0) return;
    pushHistorySnapshot();
    items.forEach(item => item.el.remove());
    items.clear();
    drag.deselect();
    hideContextMenu();
    clearState();
    refreshPowerDashboard();
    showToast('Canvas cleared');
});

// ─── Settings ───────────────────────────────────────────
const settingsModal = document.getElementById('settings-modal');

document.getElementById('btn-settings').addEventListener('click', () => {
    settingsModal.classList.toggle('hidden');
});

document.getElementById('settings-close').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
});

document.getElementById('setting-snap').addEventListener('change', (e) => {
    canvas.setSnapEnabled(e.target.checked);
});

document.getElementById('setting-grid').addEventListener('change', (e) => {
    canvas.setShowGrid(e.target.checked);
});

document.getElementById('setting-autosave').addEventListener('change', (e) => {
    autoSaveEnabled = e.target.checked;
});

// ─── Keyboard Shortcuts ─────────────────────────────────
document.addEventListener('keydown', (e) => {
    // Delete selected item
    if ((e.key === 'Delete' || e.key === 'Backspace') && drag.selectedId) {
        const item = drag.getSelectedItem();
        if (item && document.activeElement.tagName !== 'INPUT') {
            deleteItem(item);
        }
    }

    // Escape to deselect
    if (e.key === 'Escape') {
        drag.deselect();
        hideContextMenu();
        if (sidebarOpen) toggleSidebar();
        settingsModal.classList.add('hidden');
    }

    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (saveState(items, canvas.getState())) {
            showToast('Layout saved!', 'success');
        }
    }

    // Ctrl+D to duplicate
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        const item = drag.getSelectedItem();
        if (item) duplicateItem(item);
    }

    // Ctrl+Z undo
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
    }

    // Ctrl+Y or Ctrl+Shift+Z redo
    if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        redo();
    }
});

// ─── Toast ──────────────────────────────────────────────
let toastTimer = null;
function showToast(message, type = '') {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.className = `toast ${type ? 'toast-' + type : ''}`;
    toastTimer = setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 2500);
}

// ─── Auto-save ──────────────────────────────────────────
function scheduleAutoSave() {
    if (!autoSaveEnabled) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveState(items, canvas.getState());
    }, 2000);
}

function getSnapshot() {
    return {
        canvas: canvas.getState(),
        items: [...items.values()].map(item => ({
            id: item.id,
            type: item.el.dataset.type,
            data: item.data,
            x: item.x,
            y: item.y,
            parentRack: item.parentRack || null,
            slotIndex: item.slotIndex != null ? item.slotIndex : null,
            slots: item.slots ? [...item.slots] : null,
        })),
    };
}

function pushHistorySnapshot() {
    if (history.isApplying) return;
    history.undo.push(getSnapshot());
    if (history.undo.length > history.max) history.undo.shift();
    history.redo = [];
}

function applySnapshot(snapshot) {
    history.isApplying = true;
    restoreState(snapshot);
    history.isApplying = false;
}

function undo() {
    if (history.undo.length === 0) {
        showToast('Nothing to undo');
        return;
    }
    const current = getSnapshot();
    history.redo.push(current);
    const previous = history.undo.pop();
    applySnapshot(previous);
    showToast('Undid last action');
}

function redo() {
    if (history.redo.length === 0) {
        showToast('Nothing to redo');
        return;
    }
    const current = getSnapshot();
    history.undo.push(current);
    const next = history.redo.pop();
    applySnapshot(next);
    showToast('Redid action');
}

// ─── Restore State ──────────────────────────────────────
function restoreState(state) {
    // Clear current
    items.forEach(item => item.el.remove());
    items.clear();

    if (state.canvas) {
        canvas.setState(state.canvas);
    }

    if (!state.items) return;

    // First pass: create all racks
    const rackMap = {};
    state.items.filter(s => s.type === 'rack').forEach(s => {
        const item = addItemToCanvas(s.data, s.x, s.y);
        rackMap[s.id] = item.id;
        // Restore slot info
        if (s.slots) item.slots = new Array(s.data.heightU).fill(null);
    });

    // Second pass: create equipment
    state.items.filter(s => s.type === 'equipment').forEach(s => {
        const item = addItemToCanvas(s.data, s.x, s.y);

        // If it was in a rack, re-insert
        if (s.parentRack && rackMap[s.parentRack] != null) {
            const rackItem = items.get(rackMap[s.parentRack]);
            if (rackItem && s.slotIndex != null) {
                insertIntoRack(rackItem, item, s.slotIndex);
                updateRackCapacityBadge(rackItem);
            }
        }
    });
}

document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

// ─── Init: try loading saved state ──────────────────────
const saved = loadState();
if (saved) {
    restoreState(saved);
}

refreshAllRackCapacityBadges();

// ─── Done ───────────────────────────────────────────────
console.log('🎛️ RackPlanner initialized');

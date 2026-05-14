/**
 * Rack — Renders and manages 19" rack enclosures on the canvas.
 */

const SLOT_HEIGHT = 44; // 1U height in pixels
const RACK_WIDTH = 340;
const RAIL_WIDTH = 16;
const SLOT_NUMBER_WIDTH = 24;

let rackIdCounter = 0;

export function createRackElement(rackData, x, y) {
    const id = `rack-${++rackIdCounter}`;
    const el = document.createElement('div');
    el.className = 'canvas-item rack-enclosure';
    el.dataset.itemId = id;
    el.dataset.type = 'rack';
    el.dataset.heightU = rackData.heightU;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${RACK_WIDTH}px`;

    // Header
    const header = document.createElement('div');
    header.className = 'rack-header';
    if (rackData.isUploadRack) {
        header.classList.add('custom-rack-header');
    }
    header.innerHTML = `
    <span class="rack-header-name">${rackData.name}</span>
    <span>${rackData.heightU}U</span>
  `;
    el.appendChild(header);

    if (rackData.isUploadRack && rackData.calibration) {
        el.classList.add('is-custom-rack');
        const c = rackData.calibration;
        const imgW = RACK_WIDTH / c.w;
        const imgH = (rackData.heightU * SLOT_HEIGHT) / c.h;
        const left = -(imgW * c.x);
        const top = -(imgH * c.y);

        const img = document.createElement('img');
        const imageSrc = rackData.imageDataUrl
            ? rackData.imageDataUrl
            : rackData.image ? `${import.meta.env.BASE_URL}images/equipment/${rackData.image}` : null;
        img.src = imageSrc;
        img.className = 'custom-rack-bg';
        img.draggable = false;
        img.style.width = `${imgW}px`;
        img.style.height = `${imgH}px`;
        img.style.left = `${left}px`;
        img.style.top = `${top}px`;
        
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'custom-rack-bg-wrapper';
        imgWrapper.appendChild(img);
        el.appendChild(imgWrapper);
    }

    // Slots container
    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'rack-slots-container';
    slotsContainer.dataset.rackId = id;

    for (let i = 0; i < rackData.heightU; i++) {
        const slot = document.createElement('div');
        slot.className = 'rack-slot';
        slot.dataset.slotIndex = i;

        // Left rail
        const leftRail = document.createElement('div');
        leftRail.className = 'rack-slot-rail';
        leftRail.innerHTML = '<div class="rack-screw"></div><div class="rack-screw"></div>';

        // Slot number
        const slotNum = document.createElement('div');
        slotNum.className = 'rack-slot-number';
        slotNum.textContent = i + 1;

        // Content area
        const content = document.createElement('div');
        content.className = 'rack-slot-content';

        // Right rail
        const rightRail = document.createElement('div');
        rightRail.className = 'rack-slot-rail';
        rightRail.innerHTML = '<div class="rack-screw"></div><div class="rack-screw"></div>';

        slot.appendChild(leftRail);
        slot.appendChild(slotNum);
        slot.appendChild(content);
        slot.appendChild(rightRail);
        slotsContainer.appendChild(slot);
    }

    el.appendChild(slotsContainer);

    return { id, el, data: rackData, x, y, slots: new Array(rackData.heightU).fill(null) };
}

export function createEquipmentElement(eqData, x, y) {
    const id = `eq-${++rackIdCounter}`;
    const height = eqData.heightU * SLOT_HEIGHT;
    const el = document.createElement('div');
    el.className = 'canvas-item standalone-equipment';
    el.dataset.itemId = id;
    el.dataset.type = 'equipment';
    el.dataset.heightU = eqData.heightU;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${RACK_WIDTH}px`;
    el.style.height = `${height}px`;
    el.style.background = eqData.color || '#2a2a40';

    // Determine image source: uploaded data URL takes priority, then file path
    const imageSrc = eqData.imageDataUrl
        ? eqData.imageDataUrl
        : eqData.image
            ? `${import.meta.env.BASE_URL}images/equipment/${eqData.image}`
            : null;

    if (imageSrc) {
        el.innerHTML = `
      <img class="rack-equipment-image" src="${imageSrc}" alt="${eqData.brand} ${eqData.name}" draggable="false" />
      <div class="rack-equipment-label rack-equipment-label-overlay">
        <span class="rack-equipment-name">${eqData.name}</span>
        <span class="rack-equipment-brand">${eqData.brand} · ${eqData.heightU}U</span>
      </div>
    `;
    } else {
        el.innerHTML = `
      <div class="rack-equipment-label">
        <span class="rack-equipment-name">${eqData.name}</span>
        <span class="rack-equipment-brand">${eqData.brand} · ${eqData.heightU}U</span>
      </div>
    `;
    }

    const ioInputs = Array.isArray(eqData.io?.inputs) ? eqData.io.inputs.length : 0;
    const ioOutputs = Array.isArray(eqData.io?.outputs) ? eqData.io.outputs.length : 0;
    const powerText = eqData.power?.required
        ? `Power: ${eqData.power.watts || 0}W ${eqData.power.connector || ''}`.trim()
        : 'Power: none';
    const metaText = (eqData.power || eqData.io)
        ? `\n${powerText}\nI/O: ${ioInputs} in · ${ioOutputs} out`
        : '';
    el.title = `${eqData.brand} ${eqData.name} (${eqData.heightU}U)${metaText}`;

    return { id, el, data: eqData, x, y, parentRack: null, slotIndex: null };
}

export function canInsertIntoRack(rackItem, heightU, slotIndex) {
    if (slotIndex < 0) return false;
    for (let i = slotIndex; i < slotIndex + heightU; i++) {
        if (i >= rackItem.slots.length || rackItem.slots[i] !== null) {
            return false;
        }
    }
    return true;
}

export function findNearestAvailableSlot(rackItem, heightU, targetSlotIdx) {
    let offset = 1;
    let maxSlots = rackItem.slots.length;
    while (true) {
        let checkUp = targetSlotIdx - offset;
        let checkDown = targetSlotIdx + offset;
        let validUp = checkUp >= 0 && canInsertIntoRack(rackItem, heightU, checkUp);
        let validDown = checkDown < maxSlots && canInsertIntoRack(rackItem, heightU, checkDown);

        if (validUp && validDown) {
            return checkUp;
        } else if (validUp) {
            return checkUp;
        } else if (validDown) {
            return checkDown;
        }
        
        if (checkUp < 0 && checkDown >= maxSlots) {
            break; // No available slots
        }
        offset++;
    }
    return -1;
}

/**
 * Insert equipment into a rack at the given slot index.
 */
export function insertIntoRack(rackItem, equipmentItem, slotIndex) {
    const heightU = equipmentItem.data.heightU;

    // Check if slots are available
    if (!canInsertIntoRack(rackItem, heightU, slotIndex)) {
        return false;
    }

    // Occupy slots
    for (let i = slotIndex; i < slotIndex + heightU; i++) {
        rackItem.slots[i] = equipmentItem.id;
    }

    // Restyle the equipment element to sit inside the rack
    const slotsContainer = rackItem.el.querySelector('.rack-slots-container');
    const height = heightU * SLOT_HEIGHT;

    equipmentItem.el.className = 'rack-equipment';
    equipmentItem.el.style.left = `${SLOT_NUMBER_WIDTH + RAIL_WIDTH}px`;
    equipmentItem.el.style.right = `${RAIL_WIDTH}px`;
    equipmentItem.el.style.width = '';
    equipmentItem.el.style.top = `${slotIndex * SLOT_HEIGHT}px`;
    equipmentItem.el.style.height = `${height}px`;
    equipmentItem.el.style.position = 'absolute';
    equipmentItem.el.style.background = equipmentItem.data.color || '#2a2a40';

    slotsContainer.appendChild(equipmentItem.el);

    equipmentItem.parentRack = rackItem.id;
    equipmentItem.slotIndex = slotIndex;

    // Mark slots as occupied visually
    const slotEls = slotsContainer.querySelectorAll('.rack-slot');
    for (let i = slotIndex; i < slotIndex + heightU; i++) {
        slotEls[i].classList.add('slot-occupied');
    }

    return true;
}

/**
 * Remove equipment from its rack.
 */
export function removeFromRack(rackItem, equipmentItem) {
    if (!equipmentItem.parentRack) return;
    const heightU = equipmentItem.data.heightU;
    const slotIndex = equipmentItem.slotIndex;

    // Free slots
    for (let i = slotIndex; i < slotIndex + heightU; i++) {
        rackItem.slots[i] = null;
    }

    // Un-mark slots
    const slotsContainer = rackItem.el.querySelector('.rack-slots-container');
    const slotEls = slotsContainer.querySelectorAll('.rack-slot');
    for (let i = slotIndex; i < slotIndex + heightU; i++) {
        slotEls[i].classList.remove('slot-occupied');
    }

    equipmentItem.parentRack = null;
    equipmentItem.slotIndex = null;
}

/**
 * Find which slot index a Y position falls into within a rack.
 */
export function getSlotAtY(rackEl, localY) {
    const header = rackEl.querySelector('.rack-header');
    const headerH = header ? header.offsetHeight : 0;
    const slotY = localY - headerH;
    // Allow snapping to slot 0 even if slightly above the header
    if (slotY < -SLOT_HEIGHT / 2) return -1;
    return Math.round(slotY / SLOT_HEIGHT);
}

/**
 * Highlight slots on hover during drag.
 */
export function highlightSlots(rackItem, slotIndex, heightU, show) {
    const slotsContainer = rackItem.el.querySelector('.rack-slots-container');
    const slotEls = slotsContainer.querySelectorAll('.rack-slot');

    // Clear all hover highlights
    slotEls.forEach(s => s.classList.remove('slot-hover'));

    if (show) {
        for (let i = slotIndex; i < slotIndex + heightU && i < slotEls.length; i++) {
            if (i >= 0 && rackItem.slots[i] === null) {
                slotEls[i].classList.add('slot-hover');
            }
        }
    }
}

export { SLOT_HEIGHT, RACK_WIDTH };

/**
 * io-manager.js — Dynamic I/O connector list builder.
 * Manages inputs and outputs with type, count, side, and label fields.
 */

const CONNECTOR_TYPES = [
    { value: 'XLR', label: 'XLR' },
    { value: '1/4-TRS', label: '1/4" TRS' },
    { value: '1/4-TS', label: '1/4" TS' },
    { value: 'Speakon', label: 'Speakon' },
    { value: 'RJ45', label: 'RJ45 / Ethernet' },
    { value: 'USB-A', label: 'USB-A' },
    { value: 'USB-B', label: 'USB-B' },
    { value: 'USB-C', label: 'USB-C' },
    { value: 'BNC', label: 'BNC' },
    { value: 'RCA', label: 'RCA' },
    { value: 'DB25', label: 'DB25' },
    { value: 'SMA', label: 'SMA (Antenna)' },
    { value: 'Optical', label: 'Optical / Toslink' },
    { value: 'AES-EBU', label: 'AES/EBU' },
    { value: 'HDMI', label: 'HDMI' },
    { value: 'Phoenix', label: 'Phoenix / Euroblock' },
    { value: 'Powercon', label: 'Powercon' },
    { value: 'IEC', label: 'IEC C14' },
    { value: 'DMX', label: 'DMX (5-pin)' },
    { value: 'etherCON', label: 'etherCON' },
    { value: 'other', label: 'Other' },
];

const SIDE_OPTIONS = [
    { value: 'back', label: 'Back' },
    { value: 'front', label: 'Front' },
];

export class IOManager {
    constructor(inputsListEl, outputsListEl, addInputBtn, addOutputBtn) {
        this.inputsListEl = inputsListEl;
        this.outputsListEl = outputsListEl;
        this.inputs = [];
        this.outputs = [];

        addInputBtn.addEventListener('click', () => this.addIO('input'));
        addOutputBtn.addEventListener('click', () => this.addIO('output'));
    }

    addIO(direction, data = null) {
        const item = data || {
            type: 'XLR',
            count: 1,
            side: 'back',
            label: '',
        };

        const list = direction === 'input' ? this.inputs : this.outputs;
        const listEl = direction === 'input' ? this.inputsListEl : this.outputsListEl;

        list.push(item);
        this._renderList(direction, list, listEl);
    }

    removeIO(direction, index) {
        const list = direction === 'input' ? this.inputs : this.outputs;
        const listEl = direction === 'input' ? this.inputsListEl : this.outputsListEl;

        list.splice(index, 1);
        this._renderList(direction, list, listEl);
    }

    _renderList(direction, list, listEl) {
        listEl.innerHTML = '';

        if (list.length === 0) {
            listEl.innerHTML = `<div class="io-empty">No ${direction}s added</div>`;
            return;
        }

        list.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'io-item';

            // Type select
            const typeSelect = document.createElement('select');
            CONNECTOR_TYPES.forEach(ct => {
                const opt = document.createElement('option');
                opt.value = ct.value;
                opt.textContent = ct.label;
                if (ct.value === item.type) opt.selected = true;
                typeSelect.appendChild(opt);
            });
            typeSelect.addEventListener('change', (e) => { item.type = e.target.value; });

            // Count input
            const countInput = document.createElement('input');
            countInput.type = 'number';
            countInput.min = '1';
            countInput.max = '64';
            countInput.value = item.count;
            countInput.addEventListener('change', (e) => { item.count = parseInt(e.target.value, 10) || 1; });

            // Side select
            const sideSelect = document.createElement('select');
            SIDE_OPTIONS.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.value;
                opt.textContent = s.label;
                if (s.value === item.side) opt.selected = true;
                sideSelect.appendChild(opt);
            });
            sideSelect.style.flex = '1';
            sideSelect.addEventListener('change', (e) => { item.side = e.target.value; });

            // Label input
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.placeholder = 'Label';
            labelInput.value = item.label;
            labelInput.addEventListener('input', (e) => { item.label = e.target.value; });

            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'io-item-remove';
            removeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            removeBtn.addEventListener('click', () => this.removeIO(direction, index));

            el.appendChild(typeSelect);
            el.appendChild(countInput);
            el.appendChild(sideSelect);
            el.appendChild(labelInput);
            el.appendChild(removeBtn);
            listEl.appendChild(el);
        });
    }

    getData() {
        return {
            inputs: this.inputs.map(i => ({ ...i })),
            outputs: this.outputs.map(o => ({ ...o })),
        };
    }

    /**
     * Load existing I/O data.
     */
    loadData(ioData) {
        if (ioData?.inputs) {
            ioData.inputs.forEach(i => this.addIO('input', { ...i }));
        }
        if (ioData?.outputs) {
            ioData.outputs.forEach(o => this.addIO('output', { ...o }));
        }
    }
}

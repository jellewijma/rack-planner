/**
 * Catalog — Sidebar equipment catalog with search.
 */

export class Catalog {
    constructor(data, listEl, searchEl, categoryTabsEl) {
        this.racks = data.racks || [];
        this.equipment = data.equipment || [];
        this.allItems = [...this.racks, ...this.equipment];
        this.listEl = listEl;
        this.searchEl = searchEl;
        this.categoryTabsEl = categoryTabsEl;
        this.activeCategory = 'all';
        this.onAddItem = null;

        this._bindSearch();
        this._bindCategories();
        this.render();
    }

    _bindSearch() {
        this.searchEl.addEventListener('input', () => this.render());
    }

    _bindCategories() {
        this.categoryTabsEl.addEventListener('click', (e) => {
            const tab = e.target.closest('.category-tab');
            if (!tab) return;
            this.categoryTabsEl.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            this.activeCategory = tab.dataset.category;
            this.render();
        });
    }

    _filterItems() {
        const query = this.searchEl.value.toLowerCase().trim();
        return this.allItems.filter(item => {
            // Category filter
            if (this.activeCategory !== 'all' && item.category !== this.activeCategory) {
                return false;
            }
            // Search filter
            if (query) {
                const haystack = `${item.name} ${item.brand} ${item.description} ${item.category}`.toLowerCase();
                return haystack.includes(query);
            }
            return true;
        });
    }

    render() {
        const items = this._filterItems();
        this.listEl.innerHTML = '';

        if (items.length === 0) {
            this.listEl.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: var(--font-sm);">No equipment found</div>';
            return;
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'equipment-item';
            el.dataset.equipmentId = item.id;

            // Determine thumbnail: data URL (uploaded) > file path > color dot
            let thumbnailHtml;
            if (item.imageDataUrl) {
                thumbnailHtml = `<img class="eq-thumbnail" src="${item.imageDataUrl}" alt="${item.name}" draggable="false" />`;
            } else if (item.image) {
                thumbnailHtml = `<img class="eq-thumbnail" src="${import.meta.env.BASE_URL}images/equipment/${item.image}" alt="${item.name}" draggable="false" />`;
            } else {
                thumbnailHtml = `<div class="eq-color-dot" style="background: ${item.color}"></div>`;
            }

            el.innerHTML = `
        ${thumbnailHtml}
        <div class="eq-info">
          <div class="eq-name">${item.name}</div>
          <div class="eq-meta">${item.brand} · ${item.description}</div>
        </div>
        <div class="eq-height-badge">${item.category === 'rack' ? item.heightU + 'U Rack' : item.heightU + 'U'}</div>
      `;
            el.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                // Allow touch scrolling to continue
                // e.preventDefault();
                if (this.onPointerDownItem) {
                    this.onPointerDownItem(item, e);
                } else if (this.onAddItem) {
                    this.onAddItem(item);
                }
            });
            this.listEl.appendChild(el);
        });
    }

    getItemById(id) {
        return this.allItems.find(i => i.id === id) || null;
    }

    /**
     * Add a new equipment item dynamically (e.g. from upload).
     */
    addEquipment(eqData) {
        this.equipment.push(eqData);
        this.allItems.push(eqData);
        this.render();
    }
}

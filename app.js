// ============================================
// MOTHERBOARD IDENTIFICATION TOOL - STUDENT DEMO
// Simplified Logic & Slovak Localization
// ============================================

// 1. DATA DEFINITIONS (Slovak)
const MOTHERBOARD_CONFIG = {
    'Pätica procesora (CPU Socket)': [
        'Piny pätice',
        'Zámok pätice',
        'Kondenzátory napájania'
    ],
    'Sloty pre pamäte (RAM)': [
        'Zaisťovacia páčka',
        'Kontakty slotu'
    ],
    'Konektory (I/O Panel)': [
        'USB port',
        'HDMI port',
        'LAN port',
        'Audio Jack'
    ],
    'PCIe sloty (Grafika/Karty)': [
        'Poistka slotu',
        'Dátové linky'
    ],
    'Napájanie dosky': [
        '24-pin konektor',
        '8-pin CPU konektor'
    ],
    'Ostatné': [
        'Baterka BIOSu',
        'Chipset chladič',
        'M.2 slot'
    ]
};

// 2. APP STATE
const AppState = {
    // Canvas & Image
    scale: 1,
    panning: false,
    pointX: 0,
    pointY: 0,
    startPointX: 0,
    startPointY: 0,
    wsiImage: null,

    // Annotation Mode
    isAnnotating: false,
    currentMode: null, // 'region' or 'cell'
    startX: 0,
    startY: 0,
    currentBox: null, // Temporary box being drawn

    // Data Storage
    regions: [], // Array of { id, zoneName, note, boxElement, cells: [] }

    // Selection state
    currentRegionIndex: -1,
    currentCellIndex: -1,

    // UI References
    isEditing: false,
    currentBoxElement: null,
    currentRect: null
};

// 3. DOM ELEMENTS
const DOM = {
    wsiContainer: document.getElementById('wsiContainer'),
    wsiCanvas: document.getElementById('wsiCanvas'),
    ctx: document.getElementById('wsiCanvas').getContext('2d'),
    annotationLayer: document.getElementById('annotationLayer'),

    // Modals
    regionModal: document.getElementById('regionLevelModal'),
    cellModal: document.getElementById('cellLevelModal'),
    summaryModal: document.getElementById('summaryModal'),

    // Form Elements
    regionZoneSelect: document.getElementById('regionZoneSelect'),
    cellTypeSelect: document.getElementById('cellTypeSelect')
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeWSIViewer();
    initializeEventListeners();
    populateZoneDropdown();
});

function populateZoneDropdown() {
    DOM.regionZoneSelect.innerHTML = '<option value="">-- Vyberte oblasť --</option>';
    Object.keys(MOTHERBOARD_CONFIG).forEach(zone => {
        const option = document.createElement('option');
        option.value = zone;
        option.textContent = zone;
        DOM.regionZoneSelect.appendChild(option);
    });
}

function initializeWSIViewer() {
    // Load default image
    AppState.wsiImage = new Image();
    AppState.wsiImage.onload = () => {
        resizeCanvas();
        centerImage();
        renderWSI();
    };
    AppState.wsiImage.src = 'motherboard1.png';

    window.addEventListener('resize', () => {
        resizeCanvas();
        renderWSI();
    });
}

function centerImage() {
    if (!AppState.wsiImage) return;
    const rect = DOM.wsiContainer.getBoundingClientRect();
    const imgAR = AppState.wsiImage.width / AppState.wsiImage.height;
    const conAR = rect.width / rect.height;

    let renderW, renderH;
    if (imgAR > conAR) {
        renderW = rect.width;
        renderH = rect.width / imgAR;
    } else {
        renderH = rect.height;
        renderW = rect.height * imgAR;
    }

    AppState.scale = renderW / AppState.wsiImage.width;
    AppState.pointX = (rect.width - renderW) / 2;
    AppState.pointY = (rect.height - renderH) / 2;
}

function resizeCanvas() {
    const rect = DOM.wsiContainer.getBoundingClientRect();
    DOM.wsiCanvas.width = rect.width;
    DOM.wsiCanvas.height = rect.height;
}

function renderWSI() {
    if (!AppState.wsiImage || !AppState.wsiImage.complete) return;

    const ctx = DOM.ctx;
    ctx.clearRect(0, 0, DOM.wsiCanvas.width, DOM.wsiCanvas.height);

    ctx.save();
    ctx.translate(AppState.pointX, AppState.pointY);
    ctx.scale(AppState.scale, AppState.scale);
    ctx.drawImage(AppState.wsiImage, 0, 0);
    ctx.restore();

    updateAnnotationPositions();
}

// ============================================
// EVENT LISTENERS
// ============================================
function initializeEventListeners() {
    // Toolbar Buttons
    document.getElementById('btnAnnotate').addEventListener('click', () => startAnnotation('region'));
    document.getElementById('btnCellAnnotate').addEventListener('click', () => startAnnotation('cell'));
    document.getElementById('btnShowAll').addEventListener('click', showFullAnnotation);

    // Zoom Controls
    document.getElementById('btnZoomIn').addEventListener('click', () => zoom(1.2));
    document.getElementById('btnZoomOut').addEventListener('click', () => zoom(0.8));
    document.getElementById('btnReset').addEventListener('click', () => {
        AppState.scale = 1;
        centerImage();
        renderWSI();
    });

    // Mouse Events for Pan/Zoom
    DOM.wsiContainer.addEventListener('mousedown', handleMouseDown);
    DOM.wsiContainer.addEventListener('mousemove', handleMouseMove);
    DOM.wsiContainer.addEventListener('mouseup', handleMouseUp);
    DOM.wsiContainer.addEventListener('wheel', handleWheel);

    // Modal Close Buttons
    document.querySelectorAll('.modal-close, #btnSummaryClose').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.closest('.modal').id));
    });

    // Form Save Buttons
    document.getElementById('btnRegionSave').addEventListener('click', saveRegionLevel);
    document.getElementById('btnCellSave').addEventListener('click', saveCellLevel);
    document.getElementById('btnExport').addEventListener('click', exportAnnotation);

    // Annotation Overlay Cancel
    document.getElementById('btnCancelAnnotation').addEventListener('click', cancelAnnotation);
}

// ============================================
// ANNOTATION LOGIC
// ============================================
function startAnnotation(mode) {
    if (mode === 'cell' && AppState.regions.length === 0) {
        alert('Najskôr musíte vyznačiť aspoň jednu Oblasť (Region)!');
        return;
    }

    // Set cursor
    DOM.wsiContainer.classList.add('annotating');
    AppState.isAnnotating = true;
    AppState.isEditing = false;
    AppState.currentMode = mode;

    // Show overlay
    const overlay = document.getElementById('annotationOverlay');
    overlay.classList.remove('hidden');

    const label = document.getElementById('annotationModeLabel');
    if (mode === 'region') {
        label.textContent = 'OBLASŤ (REGION)';
        label.style.color = 'var(--region-color)';
    } else {
        label.textContent = 'SÚČIASTKA (COMPONENT)';
        label.style.color = 'var(--cell-color)';
    }
}

function cancelAnnotation() {
    AppState.isAnnotating = false;
    AppState.currentMode = null;
    DOM.wsiContainer.classList.remove('annotating');

    if (AppState.currentBox) {
        AppState.currentBox.remove();
        AppState.currentBox = null;
    }

    document.getElementById('annotationOverlay').classList.add('hidden');
}

function handleMouseDown(e) {
    e.preventDefault();
    const rect = DOM.wsiContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (AppState.isAnnotating) {
        // Start drawing box
        AppState.startX = mouseX;
        AppState.startY = mouseY;

        const box = document.createElement('div');
        box.className = AppState.currentMode === 'region' ? 'bounding-box' : 'bounding-box cell-box';
        box.style.left = mouseX + 'px';
        box.style.top = mouseY + 'px';
        box.style.width = '0px';
        box.style.height = '0px';

        DOM.annotationLayer.appendChild(box);
        AppState.currentBox = box;
    } else {
        // Start panning
        AppState.panning = true;
        AppState.startPointX = mouseX - AppState.pointX;
        AppState.startPointY = mouseY - AppState.pointY;
        DOM.wsiContainer.style.cursor = 'grabbing';
    }
}

function handleMouseMove(e) {
    if (AppState.isAnnotating && AppState.currentBox) {
        const rect = DOM.wsiContainer.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - AppState.startX;
        const height = currentY - AppState.startY;

        AppState.currentBox.style.width = Math.abs(width) + 'px';
        AppState.currentBox.style.height = Math.abs(height) + 'px';
        AppState.currentBox.style.left = (width < 0 ? currentX : AppState.startX) + 'px';
        AppState.currentBox.style.top = (height < 0 ? currentY : AppState.startY) + 'px';

    } else if (AppState.panning) {
        const rect = DOM.wsiContainer.getBoundingClientRect();
        AppState.pointX = e.clientX - rect.left - AppState.startPointX;
        AppState.pointY = e.clientY - rect.top - AppState.startPointY;
        renderWSI();
    }
}

function handleMouseUp(e) {
    if (AppState.isAnnotating && AppState.currentBox) {
        // Finish drawing
        finishAnnotation();
    } else if (AppState.panning) {
        AppState.panning = false;
        DOM.wsiContainer.style.cursor = 'grab';
    }
}

function finishAnnotation() {
    const box = AppState.currentBox;
    const rect = DOM.wsiContainer.getBoundingClientRect();

    // Minimal size check
    if (parseInt(box.style.width) < 10 || parseInt(box.style.height) < 10) {
        box.remove();
        cancelAnnotation();
        return;
    }

    // Convert screen coords to logical image coords
    const screenLeft = parseFloat(box.style.left);
    const screenTop = parseFloat(box.style.top);
    const screenWidth = parseFloat(box.style.width);
    const screenHeight = parseFloat(box.style.height);

    const logicalX = (screenLeft - AppState.pointX) / AppState.scale;
    const logicalY = (screenTop - AppState.pointY) / AppState.scale;
    const logicalW = screenWidth / AppState.scale;
    const logicalH = screenHeight / AppState.scale;

    AppState.isEditing = false;
    AppState.currentBoxElement = box;
    AppState.currentRect = { x: logicalX, y: logicalY, w: logicalW, h: logicalH };

    // Store data based on mode
    if (AppState.currentMode === 'region') {
        openRegionModal();
    } else {
        // Auto-assign to latest region for simplicity in demo
        if (AppState.regions.length > 0) {
            AppState.currentRegionIndex = AppState.regions.length - 1; // Default to last
            openCellModal();
        } else {
            alert('Najskôr vytvorte oblasť!');
            box.remove();
        }
    }

    AppState.isAnnotating = false;
    AppState.currentBox = null;
    DOM.wsiContainer.classList.remove('annotating');
    document.getElementById('annotationOverlay').classList.add('hidden');
}

// ============================================
// MODAL & DATA SAVING
// ============================================

// --- REGION ---
// --- REGION ---
function openRegionModal() {
    // If not editing, it's a new one (set in finishAnnotation)
    if (AppState.isEditing) {
        const region = AppState.regions[AppState.currentRegionIndex];
        document.getElementById('regionZoneSelect').value = region.zoneName;
        document.getElementById('regionComment').value = region.note || '';
        document.getElementById('btnRegionSave').textContent = 'Aktualizovať Oblasť';
    } else {
        document.getElementById('regionZoneSelect').value = '';
        document.getElementById('regionComment').value = '';
        document.getElementById('btnRegionSave').textContent = 'Uložiť Oblasť';
    }

    openModal('regionLevelModal');
}

function editRegion(index) {
    AppState.isEditing = true;
    AppState.currentRegionIndex = index;
    openRegionModal();
}

function saveRegionLevel() {
    const zoneName = document.getElementById('regionZoneSelect').value;
    const comment = document.getElementById('regionComment').value;

    if (!zoneName) {
        alert('Prosím vyberte Názov oblasti.');
        return;
    }

    if (AppState.isEditing) {
        // Update existing Region
        const region = AppState.regions[AppState.currentRegionIndex];
        region.zoneName = zoneName;
        region.note = comment;
        addLabelToBox(region.boxElement, zoneName, 'region', AppState.currentRegionIndex);
    } else {
        // Create new Region
        const newRegion = {
            id: Date.now(),
            zoneName: zoneName,
            note: comment,
            rect: AppState.currentRect, // {x,y,w,h}
            boxElement: AppState.currentBoxElement,
            cells: []
        };

        AppState.regions.push(newRegion);
        AppState.currentRegionIndex = AppState.regions.length - 1;

        // Add Label to Box
        addLabelToBox(newRegion.boxElement, zoneName, 'region', AppState.currentRegionIndex);
    }

    closeModal('regionLevelModal');
    AppState.isEditing = false;
}

// --- CELL (COMPONENT) ---
// --- CELL (COMPONENT) ---
function openCellModal() {
    const currentRegion = AppState.regions[AppState.currentRegionIndex];
    if (currentRegion) {
        populateCellDropdown(currentRegion.zoneName);
    }

    if (AppState.isEditing) {
        const cell = currentRegion.cells[AppState.currentCellIndex];
        document.getElementById('cellTypeSelect').value = cell.componentName;
        document.getElementById('cellComment').value = cell.note || '';
        document.getElementById('btnCellSave').textContent = 'Aktualizovať Súčiastku';
    } else {
        document.getElementById('cellComment').value = '';
        document.getElementById('btnCellSave').textContent = 'Uložiť Súčiastku';
    }

    openModal('cellLevelModal');
}

function editCell(regionIndex, cellIndex) {
    AppState.isEditing = true;
    AppState.currentRegionIndex = regionIndex;
    AppState.currentCellIndex = cellIndex;
    openCellModal();
}

function populateCellDropdown(regionName) {
    const select = document.getElementById('cellTypeSelect');
    select.innerHTML = '<option value="">-- Vyberte súčiastku --</option>';

    const components = MOTHERBOARD_CONFIG[regionName] || ['Iná súčiastka'];
    components.forEach(comp => {
        const option = document.createElement('option');
        option.value = comp;
        option.textContent = comp;
        select.appendChild(option);
    });
}

function saveCellLevel() {
    const compName = document.getElementById('cellTypeSelect').value;
    const comment = document.getElementById('cellComment').value;

    if (!compName) {
        alert('Prosím vyberte Názov súčiastky.');
        return;
    }

    if (AppState.isEditing) {
        const cell = AppState.regions[AppState.currentRegionIndex].cells[AppState.currentCellIndex];
        cell.componentName = compName;
        cell.note = comment;
        addLabelToBox(cell.boxElement, compName, 'cell', AppState.currentRegionIndex, AppState.currentCellIndex);
    } else {
        const newCell = {
            id: Date.now(),
            componentName: compName,
            note: comment,
            rect: AppState.currentRect,
            boxElement: AppState.currentBoxElement
        };

        // Add to current region
        const region = AppState.regions[AppState.currentRegionIndex];
        region.cells.push(newCell);
        const cellIndex = region.cells.length - 1;

        // Add Label
        addLabelToBox(newCell.boxElement, compName, 'cell', AppState.currentRegionIndex, cellIndex);
    }

    closeModal('cellLevelModal');
    AppState.isEditing = false;
}

// --- HELPERS ---
// --- HELPERS ---
function addLabelToBox(box, text, type, rIndex, cIndex = -1) {
    let label = box.querySelector('.box-label');
    if (!label) {
        label = document.createElement('div');
        label.className = 'box-label';
        if (type === 'cell') {
            label.style.backgroundColor = 'var(--cell-color)';
        }
        box.appendChild(label);
    }
    label.textContent = text;

    // Store indexes for editing
    box.dataset.type = type;
    box.dataset.rIndex = rIndex;
    box.dataset.cIndex = cIndex;

    // Update click listener
    box.onclick = (e) => {
        e.stopPropagation();
        if (AppState.isAnnotating) return;

        const t = box.dataset.type;
        const r = parseInt(box.dataset.rIndex);
        const c = parseInt(box.dataset.cIndex);

        if (t === 'region') {
            editRegion(r);
        } else {
            editCell(r, c);
        }
    };
}

function updateAnnotationPositions() {
    // Update Regions
    AppState.regions.forEach(region => {
        updateBoxPosition(region.boxElement, region.rect);
        // Update Cells within Region
        region.cells.forEach(cell => {
            updateBoxPosition(cell.boxElement, cell.rect);
        });
    });
}

function updateBoxPosition(box, rect) {
    if (!box) return;
    box.style.left = (rect.x * AppState.scale + AppState.pointX) + 'px';
    box.style.top = (rect.y * AppState.scale + AppState.pointY) + 'px';
    box.style.width = (rect.w * AppState.scale) + 'px';
    box.style.height = (rect.h * AppState.scale) + 'px';
}

function handleWheel(e) {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoom(scaleFactor);
}

function zoom(factor) {
    AppState.scale *= factor;
    document.getElementById('zoomLevel').innerText = Math.round(AppState.scale * 100) + '%';
    renderWSI();
}

function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('active');
    DOM.wsiContainer.classList.add('modal-open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    DOM.wsiContainer.classList.remove('modal-open');
}

// ============================================
// SUMMARY & EXPORT
// ============================================
function showFullAnnotation() {
    const container = document.getElementById('summaryContent');
    container.innerHTML = '';

    if (AppState.regions.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#ccc">Žiadne anotácie.</p>';
    } else {
        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.padding = '0';

        AppState.regions.forEach((region, i) => {
            const li = document.createElement('li');
            li.style.background = 'var(--bg-input)';
            li.style.margin = '10px 0';
            li.style.padding = '10px';
            li.style.borderRadius = '8px';

            li.innerHTML = `<strong style="color:var(--region-color)">${i + 1}. Oblasť: ${region.zoneName}</strong>`;
            if (region.note) li.innerHTML += `<br><small>Pozn: ${region.note}</small>`;

            if (region.cells.length > 0) {
                const subUl = document.createElement('ul');
                subUl.style.marginTop = '10px';
                subUl.style.paddingLeft = '20px';

                region.cells.forEach(cell => {
                    const subLi = document.createElement('li');
                    let cellText = `<span style="color:var(--cell-color)">• ${cell.componentName}</span>`;
                    if (cell.note) cellText += ` <span style="color:#aaa">(${cell.note})</span>`;
                    subLi.innerHTML = cellText;
                    subUl.appendChild(subLi);
                });
                li.appendChild(subUl);
            } else {
                li.innerHTML += '<br><small style="color:#666">Check: Žiadne označené súčiastky.</small>';
            }

            ul.appendChild(li);
        });
        container.appendChild(ul);
    }

    openModal('summaryModal');
}

function exportAnnotation() {
    const data = {
        timestamp: new Date().toISOString(),
        regions: AppState.regions.map(r => ({
            area: r.zoneName,
            note: r.note,
            components: r.cells.map(c => ({
                component: c.componentName,
                status: c.note
            }))
        }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hardware_audit.json';
    a.click();
}

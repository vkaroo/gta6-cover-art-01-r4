// Sunset Cover Studio — the editor. Owns the state (layout, grade, caption, one
// photo + pan + zoom per panel), wires the controls, draws the live preview, and
// exports the cover as a PNG in the three common post sizes. Photos are read on
// this machine only: sample files under app/samples/ or a file the user picks.

import { drawCover, exportCoverDataUrl } from './cover.js';
import { GRADE_ORDER, GRADES } from './grades.js';
import { LAYOUT_ORDER, LAYOUTS, panelCount, panelRects } from './layouts.js';

const SAMPLES = {
  beach: { label: 'Beach sunset', src: './samples/beach.jpg' },
  skyline: { label: 'Sunset skyline', src: './samples/skyline.jpg' },
};

const EXPORT_SIZES = [
  { label: '1080 x 1080', w: 1080, h: 1080 },
  { label: '1080 x 1350', w: 1080, h: 1350 },
  { label: '1920 x 1080', w: 1920, h: 1080 },
];

const state = {
  layout: 'vice',
  grade: 'sunset',
  title: 'SUNSET HEIST',
  subtitle: 'NEON NIGHTS',
  size: EXPORT_SIZES[1],
  selected: 0,
  panels: [],
};

const photos = {}; // key -> loaded HTMLImageElement
let uploadCount = 0;

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const previewCtx = preview.getContext('2d');

function freshPanels(layout, keepFrom) {
  const count = panelCount(layout);
  const out = [];
  for (let i = 0; i < count; i++) {
    const old = keepFrom?.[i];
    out.push({
      photo: old?.photo ?? (i === 0 ? 'beach' : keepFrom?.[0]?.photo ?? 'beach'),
      zoom: old?.zoom ?? 1,
      panX: old?.panX ?? 0,
      panY: old?.panY ?? 0,
    });
  }
  return out;
}

function loadPhoto(key) {
  if (photos[key]) return Promise.resolve(photos[key]);
  const entry = SAMPLES[key];
  if (!entry) return Promise.reject(new Error(`unknown photo ${key}`));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      photos[key] = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error(`could not load ${entry.src}`));
    img.src = entry.src;
  });
}

function photosReady() {
  const keys = new Set(state.panels.map((p) => p.photo).filter(Boolean));
  return Promise.all([...keys].map((k) => loadPhoto(k).catch(() => null)));
}

function sizePreview() {
  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(state.size.w, state.size.h));
  preview.width = Math.round(state.size.w * scale);
  preview.height = Math.round(state.size.h * scale);
}

async function drawPreview() {
  sizePreview();
  await photosReady();
  drawCover(previewCtx, state, photos, preview.width, preview.height);
}

function selectedPanel() {
  return state.panels[state.selected] ?? state.panels[0];
}

function refreshPanelButtons() {
  const box = $('panel-pick');
  box.innerHTML = '';
  state.panels.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `Panel ${i + 1}`;
    btn.className = i === state.selected ? 'on' : '';
    btn.addEventListener('click', () => {
      state.selected = i;
      syncControls();
      drawPreview();
    });
    box.appendChild(btn);
  });
}

function refreshChoiceButtons(boxId, items, current, onPick) {
  const box = $(boxId);
  box.innerHTML = '';
  for (const [key, label] of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className = key === current ? 'on' : '';
    btn.addEventListener('click', () => onPick(key));
    box.appendChild(btn);
  }
}

function syncControls() {
  const panel = selectedPanel();
  $('panel-number').textContent = String(state.selected + 1);
  $('panel-count').textContent = String(state.panels.length);
  $('zoom').value = String(Math.round((panel.zoom - 1) * 100));
  $('zoom-value').textContent = `${Math.round(panel.zoom * 100)}%`;
  refreshPanelButtons();
  refreshChoiceButtons(
    'layout-pick',
    LAYOUT_ORDER.map((k) => [k, LAYOUTS[k].label]),
    state.layout,
    (key) => {
      state.layout = key;
      state.panels = freshPanels(key, state.panels);
      state.selected = 0;
      syncControls();
      drawPreview();
    },
  );
  refreshChoiceButtons(
    'grade-pick',
    GRADE_ORDER.map((k) => [k, GRADES[k].label]),
    state.grade,
    (key) => {
      state.grade = key;
      syncControls();
      drawPreview();
    },
  );
  refreshChoiceButtons(
    'size-pick',
    EXPORT_SIZES.map((s) => [`${s.w}x${s.h}`, s.label]),
    `${state.size.w}x${state.size.h}`,
    (key) => {
      const [w, h] = key.split('x').map(Number);
      state.size = EXPORT_SIZES.find((s) => s.w === w && s.h === h);
      syncControls();
      drawPreview();
    },
  );
}

function setStatus(text) {
  $('status').textContent = text;
}

function downloadPng(dataUrl, name) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function exportOne(size) {
  await photosReady();
  const url = exportCoverDataUrl(state, photos, size.w, size.h);
  downloadPng(url, `sunset-cover-${size.w}x${size.h}.png`);
  setStatus(`Exported ${size.w} x ${size.h} PNG.`);
}

function fileToPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const key = `upload-${++uploadCount}`;
      const img = new Image();
      img.onload = () => {
        photos[key] = img;
        resolve(key);
      };
      img.onerror = () => reject(new Error('that file is not a readable image'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('could not read that file'));
    reader.readAsDataURL(file);
  });
}

// Drag a panel's photo inside the preview: pointer down picks the panel under
// the pointer, dragging pans that photo, releasing stops.
let drag = null;
preview.addEventListener('pointerdown', (event) => {
  const box = preview.getBoundingClientRect();
  const x = (event.clientX - box.left) * (preview.width / box.width);
  const y = (event.clientY - box.top) * (preview.height / box.height);
  const rects = panelRects(state.layout, preview.width, preview.height);
  const hit = rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  if (hit < 0) return;
  state.selected = hit;
  syncControls();
  drag = { panel: state.panels[hit], startX: x, startY: y, panX: state.panels[hit].panX, panY: state.panels[hit].panY, rect: rects[hit] };
  preview.setPointerCapture(event.pointerId);
});
preview.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const box = preview.getBoundingClientRect();
  const x = (event.clientX - box.left) * (preview.width / box.width);
  const y = (event.clientY - box.top) * (preview.height / box.height);
  drag.panel.panX = drag.panX + (x - drag.startX) / drag.rect.w;
  drag.panel.panY = drag.panY + (y - drag.startY) / drag.rect.h;
  drawPreview();
});
preview.addEventListener('pointerup', () => {
  drag = null;
});

$('photo-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const key = await fileToPhoto(file);
    selectedPanel().photo = key;
    setStatus(`Loaded ${file.name}.`);
    await drawPreview();
  } catch (err) {
    setStatus(String(err.message || err));
  }
});

$('sample-beach').addEventListener('click', async () => {
  selectedPanel().photo = 'beach';
  await drawPreview();
});
$('sample-skyline').addEventListener('click', async () => {
  selectedPanel().photo = 'skyline';
  await drawPreview();
});
$('fill-all').addEventListener('click', async () => {
  const key = selectedPanel().photo;
  state.panels.forEach((p) => {
    p.photo = key;
  });
  setStatus('Used this photo in every panel.');
  await drawPreview();
});
$('zoom').addEventListener('input', (event) => {
  selectedPanel().zoom = 1 + Number(event.target.value) / 100;
  $('zoom-value').textContent = `${Math.round(selectedPanel().zoom * 100)}%`;
  drawPreview();
});
$('surprise').addEventListener('click', async () => {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  state.layout = pick(LAYOUT_ORDER);
  state.grade = pick(GRADE_ORDER);
  state.panels = freshPanels(state.layout, state.panels);
  state.selected = 0;
  syncControls();
  await drawPreview();
  setStatus(`Surprise: ${LAYOUTS[state.layout].label} layout, ${GRADES[state.grade].label} grade.`);
});
$('reset-pos').addEventListener('click', async () => {
  const panel = selectedPanel();
  panel.zoom = 1;
  panel.panX = 0;
  panel.panY = 0;
  syncControls();
  await drawPreview();
});
$('title').addEventListener('input', (event) => {
  state.title = event.target.value;
  drawPreview();
});
$('subtitle').addEventListener('input', (event) => {
  state.subtitle = event.target.value;
  drawPreview();
});
$('export-one').addEventListener('click', () => exportOne(state.size));
$('export-all').addEventListener('click', async () => {
  for (const size of EXPORT_SIZES) {
    await exportOne(size);
    await new Promise((r) => setTimeout(r, 350));
  }
});

// Test and screenshot hook: render the current cover at any size and hand back
// the PNG, so the shot driver can verify the export dimensions exactly.
window.__cover = {
  exportPngDataUrl: (w, h) => exportCoverDataUrl(state, photos, w, h),
};

async function readyFonts() {
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Fall back to the system sans if a font fails to load; the cover still draws.
  }
}

// Screenshot scenes, driven by ?shot=: cover scenes draw the finished cover
// full-frame; the editor scene shows the app with a photo loaded.
async function applyShotScene() {
  const params = new URLSearchParams(location.search);
  const scene = params.get('shot');
  if (!scene) return false;
  const photo = params.get('photo') ?? 'beach';
  if (scene === 'editor') {
    state.panels = freshPanels(state.layout, null).map((p) => ({ ...p, photo }));
    return false;
  }
  const scenes = {
    cover: { layout: 'vice', grade: 'sunset', title: 'SUNSET HEIST', subtitle: 'NEON NIGHTS', photos: ['beach', 'skyline', 'beach'] },
    square: { layout: 'streets', grade: 'neon', title: 'BOULEVARD QUEEN', subtitle: 'VICE CITY NIGHTS', photos: ['skyline', 'beach', 'beach', 'skyline'] },
    portrait: { layout: 'vice', grade: 'palm', title: 'PALM ROYALE', subtitle: 'GOLDEN HOUR', photos: ['skyline', 'beach', 'skyline'] },
  };
  const picked = scenes[scene];
  if (!picked) return false;
  document.body.classList.add('shot-cover');
  state.layout = picked.layout;
  state.grade = picked.grade;
  state.title = picked.title;
  state.subtitle = picked.subtitle;
  state.panels = freshPanels(picked.layout, null).map((p, i) => ({
    ...p,
    photo: picked.photos[i] ?? picked.photos[0],
  }));
  await photosReady();
  preview.width = window.innerWidth;
  preview.height = window.innerHeight;
  drawCover(previewCtx, state, photos, preview.width, preview.height);
  return true;
}

state.panels = freshPanels(state.layout, null);
syncControls();
(async () => {
  await readyFonts();
  const isCoverScene = await applyShotScene();
  if (!isCoverScene) await drawPreview();
  window.__shotReady = true;
})();

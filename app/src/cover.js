// The cover renderer: draws the multi-panel poster onto any canvas at any size.
// Photos are drawn cover-fit into their panels (panned and zoomed per panel), then
// the colour grade is painted over the whole frame, then the caption is lettered
// in Anton and Bebas Neue over a dark scrim at the bottom. Pure canvas 2D, no
// network, no library.

import { GRADES, paintGrade } from './grades.js';
import { panelRects } from './layouts.js';

// Draw one photo into its panel, cover-fit, shifted by the panel's pan (fractions
// of the panel's own width and height) and scaled by its zoom.
function drawPanelPhoto(ctx, img, rect, zoom, panX, panY) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const x = rect.x + (rect.w - drawW) / 2 + panX * rect.w;
  const y = rect.y + (rect.h - drawH) / 2 + panY * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, x, y, drawW, drawH);
  ctx.restore();
}

function drawPanelEmpty(ctx, rect, label) {
  const shade = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  shade.addColorStop(0, '#241a33');
  shade.addColorStop(1, '#120e1c');
  ctx.fillStyle = shade;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `${Math.max(14, Math.round(rect.w * 0.035))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

// Draw text with manual letter tracking, left-aligned at x, and return its width.
function drawTracked(ctx, text, x, y, tracking) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  return cursor - x - tracking;
}

// Draw the whole cover. state: { layout, grade, title, subtitle, panels } where
// panels[i] is { photo, zoom, panX, panY }. photos: key -> HTMLImageElement.
export function drawCover(ctx, state, photos, W, H) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const rects = panelRects(state.layout, W, H);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: null, zoom: 1, panX: 0, panY: 0 };
    const img = panel.photo ? photos[panel.photo] : null;
    if (img && img.naturalWidth > 0) {
      drawPanelPhoto(ctx, img, rect, panel.zoom, panel.panX, panel.panY);
    } else {
      drawPanelEmpty(ctx, rect, `Panel ${i + 1}`);
    }
  });
  paintGrade(ctx, W, H, grade);

  // Caption: a dark scrim across the bottom, subtitle letterspaced in the grade's
  // accent colour, then the big Anton title with a black outline, and a short
  // accent bar beneath it.
  const margin = W * 0.05;
  const titleSize = Math.round(W * 0.115);
  const subSize = Math.round(W * 0.042);
  const scrimTop = H - Math.round(H * 0.3);
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, H);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(1, `rgba(0,0,0,${grade.scrim})`);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, W, H - scrimTop);

  const title = (state.title || '').toUpperCase();
  const subtitle = (state.subtitle || '').toUpperCase();
  const titleBaseline = H - Math.round(H * 0.05);
  const subBaseline = titleBaseline - titleSize - Math.round(H * 0.02);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (subtitle) {
    ctx.font = `${subSize}px "Bebas Neue", sans-serif`;
    ctx.fillStyle = grade.accent;
    drawTracked(ctx, subtitle, margin, subBaseline, subSize * 0.35);
  }
  if (title) {
    // Shrink the title until it fits the frame: a long caption must never clip
    // off the right edge at square or portrait sizes.
    let fittedSize = titleSize;
    ctx.font = `${fittedSize}px Anton, sans-serif`;
    while (fittedSize > Math.round(W * 0.05) && ctx.measureText(title).width > W - margin * 2) {
      fittedSize -= 2;
      ctx.font = `${fittedSize}px Anton, sans-serif`;
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, Math.round(W * 0.011));
    ctx.strokeStyle = '#12081f';
    ctx.strokeText(title, margin, titleBaseline);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, margin, titleBaseline);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(margin, titleBaseline + Math.round(H * 0.018), Math.round(W * 0.16), Math.max(3, Math.round(H * 0.006)));
  }
}

// Render the cover at export size and return it as a PNG data URL.
export function exportCoverDataUrl(state, photos, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, state, photos, width, height);
  return canvas.toDataURL('image/png');
}

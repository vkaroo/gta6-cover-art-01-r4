// Panel layouts for the cover. Each layout turns a cover of width W and height H
// into the rectangles its photos fill, leaving a black gutter between panels.
// Vice: one wide hero panel over two panels below. Streets: a 2 x 2 grid.
// Solo: a single full-bleed photo.

export const LAYOUTS = {
  vice: { label: 'Vice', panels: 3 },
  streets: { label: 'Streets', panels: 4 },
  solo: { label: 'Solo', panels: 1 },
};

export const LAYOUT_ORDER = ['vice', 'streets', 'solo'];

export function panelCount(layout) {
  return LAYOUTS[layout]?.panels ?? 3;
}

export function panelRects(layout, W, H) {
  const gap = Math.max(4, Math.round(Math.min(W, H) * 0.008));
  if (layout === 'streets') {
    const halfW = (W - gap) / 2;
    const halfH = (H - gap) / 2;
    return [
      { x: 0, y: 0, w: halfW, h: halfH },
      { x: halfW + gap, y: 0, w: halfW, h: halfH },
      { x: 0, y: halfH + gap, w: halfW, h: halfH },
      { x: halfW + gap, y: halfH + gap, w: halfW, h: halfH },
    ];
  }
  if (layout === 'solo') {
    return [{ x: 0, y: 0, w: W, h: H }];
  }
  // Vice: hero on top, two panels below.
  const heroH = Math.round(H * 0.58);
  const lowerH = H - heroH - gap;
  const halfW = (W - gap) / 2;
  return [
    { x: 0, y: 0, w: W, h: heroH },
    { x: 0, y: heroH + gap, w: halfW, h: lowerH },
    { x: halfW + gap, y: heroH + gap, w: halfW, h: lowerH },
  ];
}

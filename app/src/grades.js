// Colour grades for Sunset Cover Studio. Each grade is a wash of colour laid over
// the photos, a warm or cool glow from the top of the frame, the accent colour the
// subtitle is lettered in, and how heavy the dark scrim behind the caption is.
// Nothing here reaches the network: the grades are pure canvas paint.

export const GRADES = {
  sunset: {
    label: 'Sunset',
    wash: '#ff7a2f',
    washAlpha: 0.14,
    glow: '#ffd27d',
    glowAlpha: 0.2,
    accent: '#ffb347',
    scrim: 0.42,
  },
  neon: {
    label: 'Neon',
    wash: '#ff2e88',
    washAlpha: 0.13,
    glow: '#2ee6ff',
    glowAlpha: 0.15,
    accent: '#ff5ea8',
    scrim: 0.48,
  },
  palm: {
    label: 'Palm',
    wash: '#19c37d',
    washAlpha: 0.13,
    glow: '#ffe08a',
    glowAlpha: 0.14,
    accent: '#7dffc4',
    scrim: 0.42,
  },
  noir: {
    label: 'Noir',
    wash: '#0a0a14',
    washAlpha: 0.34,
    glow: '#ffffff',
    glowAlpha: 0.05,
    accent: '#f2f2f2',
    scrim: 0.55,
  },
};

export const GRADE_ORDER = ['sunset', 'neon', 'palm', 'noir'];

// Paint a grade over a finished cover: a flat wash, a glow spilling from the top
// edge, and a vignette that darkens the corners so the lettering sits cleanly.
export function paintGrade(ctx, width, height, grade) {
  ctx.save();
  ctx.globalAlpha = grade.washAlpha;
  ctx.fillStyle = grade.wash;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = grade.glowAlpha;
  const glow = ctx.createRadialGradient(
    width * 0.28,
    -height * 0.1,
    0,
    width * 0.28,
    -height * 0.1,
    width * 0.85,
  );
  glow.addColorStop(0, grade.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.32;
  const shade = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.42,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

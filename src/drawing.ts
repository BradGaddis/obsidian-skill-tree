/**
 * Draw a straight arrow between two points on a canvas.
 * @param ctx Canvas rendering context used for drawing.
 * @param x1 Starting X coordinate.
 * @param y1 Starting Y coordinate.
 * @param x2 Ending X coordinate (arrow tip).
 * @param y2 Ending Y coordinate (arrow tip).
 * @param scale Optional scale factor to adjust arrow head size (default 1).
 */
export function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, scale = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const headLen = 12 / Math.max(0.5, scale);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const p1x = x2 - headLen * Math.cos(angle - Math.PI / 6);
  const p1y = y2 - headLen * Math.sin(angle - Math.PI / 6);
  const p2x = x2 - headLen * Math.cos(angle + Math.PI / 6);
  const p2y = y2 - headLen * Math.sin(angle + Math.PI / 6);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.closePath();
  ctx.fill();
}

// draw a cubic bezier from p0 to p3 with control points p1,p2 and an arrowhead at p3
/**
 * Draw a cubic bezier curve with an arrow head at the end point.
 * @param ctx Canvas rendering context used for drawing.
 * @param p0x Starting point X coordinate.
 * @param p0y Starting point Y coordinate.
 * @param p1x First control point X coordinate.
 * @param p1y First control point Y coordinate.
 * @param p2x Second control point X coordinate.
 * @param p2y Second control point Y coordinate.
 * @param p3x End point X coordinate (arrow tip).
 * @param p3y End point Y coordinate (arrow tip).
 * @param scale Optional scale factor to adjust arrow head size (default 1).
 */
export function drawBezierArrow(ctx: CanvasRenderingContext2D, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, scale = 1) {
  ctx.beginPath();
  ctx.moveTo(p0x, p0y);
  ctx.bezierCurveTo(p1x, p1y, p2x, p2y, p3x, p3y);
  ctx.stroke();
  // derivative at t=1 for tangent direction: 3*(p3-p2)
  const dx = 3 * (p3x - p2x);
  const dy = 3 * (p3y - p2y);
  const angle = Math.atan2(dy, dx);
  const headLen = 12 / Math.max(0.5, scale);
  const pA1x = p3x - headLen * Math.cos(angle - Math.PI / 6);
  const pA1y = p3y - headLen * Math.sin(angle - Math.PI / 6);
  const pA2x = p3x - headLen * Math.cos(angle + Math.PI / 6);
  const pA2y = p3y - headLen * Math.sin(angle + Math.PI / 6);
  ctx.beginPath();
  ctx.moveTo(p3x, p3y);
  ctx.lineTo(pA1x, pA1y);
  ctx.lineTo(pA2x, pA2y);
  ctx.closePath();
  ctx.fill();
}

// approximate distance squared from point to cubic bezier by sampling
/**
 * Approximate the squared distance from a point to a cubic bezier curve.
 * Samples the curve and returns the minimum squared distance and the
 * parameter t corresponding to the closest sampled point.
 * @param x Point X coordinate.
 * @param y Point Y coordinate.
 * @param p0x Curve start X coordinate.
 * @param p0y Curve start Y coordinate.
 * @param p1x First control point X coordinate.
 * @param p1y First control point Y coordinate.
 * @param p2x Second control point X coordinate.
 * @param p2y Second control point Y coordinate.
 * @param p3x Curve end X coordinate.
 * @param p3y Curve end Y coordinate.
 * @param samples Number of samples used for approximation (default 24).
 * @returns Object containing `dist2` (minimum squared distance) and `t` (approximate parameter).
 */
export function distanceSqToBezier(x: number, y: number, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, samples = 24) {
  let minDist2 = Infinity;
  let closestT = 0;
  let lastX = p0x, lastY = p0y;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    // cubic bezier point
    const bx = mt * mt * mt * p0x + 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t * p3x;
    const by = mt * mt * mt * p0y + 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t * p3y;
    // distance from (x,y) to segment last->(bx,by)
    const vx = bx - lastX;
    const vy = by - lastY;
    const wx = x - lastX;
    const wy = y - lastY;
    const vlen2 = vx * vx + vy * vy;
    let proj = 0;
    if (vlen2 > 0) proj = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vlen2));
    const px = lastX + proj * vx;
    const py = lastY + proj * vy;
    const dx = x - px;
    const dy = y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < minDist2) {
      minDist2 = d2;
      closestT = t;
    }
    lastX = bx; lastY = by;
  }
  return { dist2: minDist2, t: closestT };
}

/**
 * Compute control points for a cubic bezier curve between two nodes.
 * Control points are adjusted by the provided sides and radii so that
 * curves originate/terminate outside node bounds when needed.
 * @param ax Source X coordinate.
 * @param ay Source Y coordinate.
 * @param bx Target X coordinate.
 * @param by Target Y coordinate.
 * @param fromSide Optional side ('top'|'right'|'bottom'|'left') of the source node.
 * @param toSide Optional side ('top'|'right'|'bottom'|'left') of the target node.
 * @param rFrom Radius of source node (used to offset control point).
 * @param rTo Radius of target node (used to offset control point).
 * @returns Object with control points `{ c1x, c1y, c2x, c2y }`.
 */
export function computeBezierControls(ax: number, ay: number, bx: number, by: number, fromSide: any, toSide: any, rFrom: number, rTo: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy) || 1;
  const baseOffset = Math.max(40, dist * 0.35);
  let c1x = ax, c1y = ay, c2x = bx, c2y = by;
  if (fromSide) {
    if (fromSide === 'top') { c1x = ax; c1y = ay - (rFrom + baseOffset); }
    else if (fromSide === 'bottom') { c1x = ax; c1y = ay + (rFrom + baseOffset); }
    else if (fromSide === 'left') { c1x = ax - (rFrom + baseOffset); c1y = ay; }
    else if (fromSide === 'right') { c1x = ax + (rFrom + baseOffset); c1y = ay; }
  } else {
    c1x = ax + dx * 0.3;
    c1y = ay + dy * 0.3;
  }
  if (toSide) {
    if (toSide === 'top') { c2x = bx; c2y = by - (rTo + baseOffset); }
    else if (toSide === 'bottom') { c2x = bx; c2y = by + (rTo + baseOffset); }
    else if (toSide === 'left') { c2x = bx - (rTo + baseOffset); c2y = by; }
    else if (toSide === 'right') { c2x = bx + (rTo + baseOffset); c2y = by; }
  } else {
    c2x = bx - dx * 0.3;
    c2y = by - dy * 0.3;
  }
  return { c1x, c1y, c2x, c2y };
}

/**
 * Parse a simple CSS color string (hex `#rgb`/`#rrggbb` or `rgb()`/`rgba()`).
 * Returns an object `{ r, g, b }` with numeric channels or `null` if parsing fails.
 * @param s CSS color string.
 */
export function parseCSSColor(s: string) {
  s = s.trim();
  if (!s) return null;
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const bigint = parseInt(hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(',').map(p => parseFloat(p));
    return { r: parts[0], g: parts[1], b: parts[2] };
  }
  return null;
}

/**
 * Compute relative luminance of an RGB color in linear space.
 * @param param0 Object with `r`,`g`,`b` channels in 0-255 range.
 * @returns Luminance value in range 0..1.
 */
export function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const sr = r / 255; const sg = g / 255; const sb = b / 255;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * linear(sr) + 0.7152 * linear(sg) + 0.0722 * linear(sb);
}

/**
 * Convert RGB color (0-255) to HSL representation.
 * @param r Red channel 0-255.
 * @param g Green channel 0-255.
 * @param b Blue channel 0-255.
 * @returns Object `{ h, s, l }` with h in 0..1 and s,l in 0..1.
 */
export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

/**
 * Convert HSL color to RGB (0-255 channels).
 * @param h Hue in 0..1.
 * @param s Saturation in 0..1.
 * @param l Lightness in 0..1.
 * @returns Object `{ r, g, b }` with channels in 0..255.
 */
export function hslToRgb(h: number, s: number, l: number) {
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

/**
 * Choose a reasonable edge color based on current theme CSS variables.
 * Falls back to computing contrast against the background and returns
 * a CSS color string (e.g. `#fff` or `#000`).
 * @returns CSS color string for drawing edges.
 */
export function chooseEdgeColor() {
  try {
    const docStyle = getComputedStyle(document.documentElement);
    const accent = docStyle.getPropertyValue('--interactive-accent');
    if (accent && accent.trim()) return accent.trim();
    const text = docStyle.getPropertyValue('--text-normal');
    if (text && text.trim()) return text.trim();
    // fallback: choose contrast against background
    const bg = docStyle.getPropertyValue('--background-primary') || '';
    const parsed = parseCSSColor(bg) || parseCSSColor(getComputedStyle(document.body).backgroundColor || '');
    if (parsed) {
      const lum = luminance(parsed);
      return lum < 0.5 ? '#fff' : '#000';
    }
  } catch (e) {}
  return '#fff';
}
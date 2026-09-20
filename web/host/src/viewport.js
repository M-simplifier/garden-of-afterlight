export function renderScale(value) {
  const scale = Number(value);
  return [1, 0.75, 0.5].includes(scale) ? scale : 1;
}

// Keep display pixels and UI stable. Quality scales the renderer's scene target,
// never the canvas, so it cannot enlarge text or change input coordinates.
export function drawingSize(width, height, { pixelRatio = 1, maxDimension = Infinity } = {}) {
  if (!(width > 0 && height > 0)) return { width: 1280, height: 720 };
  const density = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const factor = Math.min(density, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)) };
}

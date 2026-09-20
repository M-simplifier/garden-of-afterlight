// The canvas fills its CSS viewport; keep the same aspect ratio in the drawing
// buffer, with an explicit pixel budget independent of monitor DPR.
export function drawingSize(width, height, pixelBudget = 1280 * 720) {
  if (!(width > 0 && height > 0)) return { width: 1280, height: 720 };
  const scale = Math.min(1, Math.sqrt(pixelBudget / (width * height)));
  return { width: Math.max(2, Math.floor(width * scale / 2) * 2),
    height: Math.max(2, Math.floor(height * scale / 2) * 2) };
}

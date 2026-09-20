// Opt-in diagnostics for comparing the same paused scene at different display
// resolutions. rAF intervals include browser scheduling; they are not GPU times
// or a gameplay benchmark. Normal play never runs this sampler.
export function createRenderCheck(enabled) {
  if (!enabled) return null;
  let calls, previous, cpu, intervals, result;
  const reset = () => { calls = 0; previous = null; cpu = []; intervals = []; result = null; };
  const summary = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * 0.95) - 1] };
  };
  reset();
  return {
    reset,
    sample(draw, at) {
      if (result) return;
      const began = performance.now();
      draw();
      const elapsed = performance.now() - began;
      // Exclude resize, initial shader work and ten settling frames.
      if (calls >= 10) { cpu.push(elapsed); intervals.push(at - previous); }
      previous = at;
      calls++;
      if (calls === 100) result = { frames: cpu.length, cpuMs: summary(cpu), intervalMs: summary(intervals) };
    },
    snapshot: () => ({ calls, result }),
  };
}

import { useRef, useEffect, useCallback, useState } from 'react';

const CELL = 28;
const AISLE_COLS = [9, 10, 19, 20, 29, 30];
const AISLE_ROWS = [6, 7, 14, 15, 22, 23];
const ZONE_LABELS = [
  { col: 0,  row: 0,  w: 9, h: 6,  label: 'ZONE A' },
  { col: 11, row: 0,  w: 8, h: 6,  label: 'ZONE B' },
  { col: 21, row: 0,  w: 8, h: 6,  label: 'ZONE C' },
  { col: 31, row: 0,  w: 9, h: 6,  label: 'ZONE D' },
  { col: 0,  row: 8,  w: 9, h: 6,  label: 'ZONE E' },
  { col: 11, row: 8,  w: 8, h: 6,  label: 'ZONE F' },
  { col: 21, row: 8,  w: 8, h: 6,  label: 'ZONE G' },
  { col: 31, row: 8,  w: 9, h: 6,  label: 'ZONE H' },
];

const STATUS_COLORS = {
  available: { fill: 'rgba(20,184,166,0.55)', hover: 'rgba(45,212,191,0.75)' },
  occupied:  { fill: 'rgba(220,38,38,0.60)',  hover: 'rgba(248,113,113,0.80)' },
  mine:      { fill: 'rgba(14,165,233,0.65)', hover: 'rgba(56,189,248,0.85)' },
  reserved:  { fill: 'rgba(124,58,237,0.55)', hover: 'rgba(167,139,250,0.75)' },
  aisle:     { fill: 'rgba(255,255,255,0.025)' },
  empty:     { fill: 'rgba(20,25,36,0.8)' },
};

export const useWarehouseCanvas = (cells, showHeatmap, showGrid) => {
  const canvasRef   = useRef(null);
  const panRef      = useRef({ x: 40, y: 30 });
  const zoomRef     = useRef(1);
  const dragging    = useRef(false);
  const dragStart   = useRef({ x: 0, y: 0 });
  const panStart    = useRef({ x: 0, y: 0 });
  const hovered     = useRef(null);
  const cellsRef    = useRef(cells);
  const heatRef     = useRef({});
  const rafId       = useRef(null);

  const [zoom, setZoom]             = useState(1);
  const [hoveredCell, setHoveredCell] = useState(null);

  // keep cells in ref for canvas access without re-registering listeners
  useEffect(() => {
    cellsRef.current = cells;
    // build traffic map
    cells.forEach(c => {
      const key = `${c.col}_${c.row}`;
      if (!heatRef.current[key]) heatRef.current[key] = c.traffic / 100 || Math.random();
    });
  }, [cells]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const z = zoomRef.current;
    const { x: ox, y: oy } = panRef.current;
    const cs = CELL * z;

    ctx.clearRect(0, 0, W, H);

    // Background dots
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    const ds = 28 * z;
    for (let x = ox % ds; x < W; x += ds)
      for (let y = oy % ds; y < H; y += ds)
        ctx.fillRect(x - 0.5, y - 0.5, 1.5, 1.5);

    // Cells
    for (const cell of cellsRef.current) {
      const cx = ox + cell.col * cs;
      const cy = oy + cell.row * cs;
      if (cx + cs < 0 || cy + cs < 0 || cx > W || cy > H) continue;

      const gap = z < 0.45 ? 0.5 : 1;
      const isHov = hovered.current?.col === cell.col && hovered.current?.row === cell.row;

      // Base fill
      const colors = cell.isAisle
        ? STATUS_COLORS.aisle
        : (STATUS_COLORS[cell.status] || STATUS_COLORS.empty);
      ctx.fillStyle = isHov && !cell.isAisle ? colors.hover : colors.fill;
      ctx.fillRect(cx + gap, cy + gap, cs - gap * 2, cs - gap * 2);

      // Heatmap
      if (showHeatmap && !cell.isAisle) {
        const t = heatRef.current[`${cell.col}_${cell.row}`] || 0;
        let hc = null;
        if (t > 0.8) hc = 'rgba(239,68,68,0.4)';
        else if (t > 0.6) hc = 'rgba(239,68,68,0.22)';
        else if (t > 0.4) hc = 'rgba(245,158,11,0.18)';
        else if (t > 0.2) hc = 'rgba(20,184,166,0.1)';
        if (hc) {
          ctx.fillStyle = hc;
          ctx.fillRect(cx + gap, cy + gap, cs - gap * 2, cs - gap * 2);
        }
      }

      // Grid lines
      if (showGrid && z > 0.6) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(cx + gap, cy + gap, cs - gap * 2, cs - gap * 2);
      }

      // Hover outline
      if (isHov && !cell.isAisle) {
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx + gap, cy + gap, cs - gap * 2, cs - gap * 2);
      }

      // Cell label on zoom
      if (z > 1.9 && !cell.isAisle && cell.cellId) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `${Math.floor(4 * z)}px JetBrains Mono`;
        ctx.textAlign = 'center';
        ctx.fillText(
          `${cell.col},${cell.row}`,
          cx + cs / 2,
          cy + cs / 2 + 2
        );
      }
    }

    // Zone labels (cluster view)
    if (z < 0.9) {
      ZONE_LABELS.forEach(z2 => {
        const rx = ox + z2.col * cs, ry = oy + z2.row * cs;
        const rw = z2.w * cs, rh = z2.h * cs;
        ctx.fillStyle = 'rgba(20,184,166,0.055)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = 'rgba(20,184,166,0.22)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, ry, rw, rh);
        if (z > 0.25) {
          ctx.fillStyle = 'rgba(20,184,166,0.75)';
          ctx.font = `bold ${Math.floor(11 * z)}px Barlow Condensed`;
          ctx.textAlign = 'center';
          ctx.fillText(z2.label, rx + rw / 2, ry + rh / 2 + 4);
        }
      });
    }
  }, [showHeatmap, showGrid]);

  // schedule render
  const scheduleRender = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(render);
  }, [render]);

  useEffect(() => { scheduleRender(); }, [cells, scheduleRender]);

  // ─── Event handlers ───
  const onMouseDown = useCallback((e) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...panRef.current };
  }, []);

  const onMouseMove = useCallback((e) => {
    if (dragging.current) {
      panRef.current = {
        x: panStart.current.x + (e.clientX - dragStart.current.x),
        y: panStart.current.y + (e.clientY - dragStart.current.y),
      };
      scheduleRender();
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const z = zoomRef.current;
    const cs = CELL * z;
    const col = Math.floor((e.clientX - rect.left - panRef.current.x) / cs);
    const row = Math.floor((e.clientY - rect.top  - panRef.current.y) / cs);

    if (col >= 0 && col < 40 && row >= 0 && row < 30) {
      const found = cellsRef.current.find(c => c.col === col && c.row === row);
      hovered.current = found && !found.isAisle ? found : null;
    } else {
      hovered.current = null;
    }
    setHoveredCell(hovered.current);
    scheduleRender();
  }, [scheduleRender]);

  const onMouseUp = useCallback((e) => {
    const moved =
      Math.abs(e.clientX - dragStart.current.x) > 4 ||
      Math.abs(e.clientY - dragStart.current.y) > 4;
    dragging.current = false;
    if (moved) return null; // was a pan, not a click
    return hovered.current || null;
  }, []);

  const onMouseLeave = useCallback(() => {
    dragging.current = false;
    hovered.current = null;
    setHoveredCell(null);
    scheduleRender();
  }, [scheduleRender]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZ = Math.max(0.15, Math.min(4.0, zoomRef.current * factor));
    panRef.current.x = mx - (mx - panRef.current.x) * (newZ / zoomRef.current);
    panRef.current.y = my - (my - panRef.current.y) * (newZ / zoomRef.current);
    zoomRef.current = newZ;
    setZoom(newZ);
    scheduleRender();
  }, [scheduleRender]);

  const fitView = useCallback((canvasW, canvasH) => {
    const totalW = 40 * CELL, totalH = 30 * CELL;
    const fz = Math.min((canvasW - 60) / totalW, (canvasH - 40) / totalH);
    zoomRef.current = fz;
    panRef.current = {
      x: (canvasW - totalW * fz) / 2,
      y: (canvasH - totalH * fz) / 2,
    };
    setZoom(fz);
    scheduleRender();
  }, [scheduleRender]);

  const zoomBy = useCallback((f) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const newZ = Math.max(0.15, Math.min(4.0, zoomRef.current * f));
    panRef.current.x = cx - (cx - panRef.current.x) * (newZ / zoomRef.current);
    panRef.current.y = cy - (cy - panRef.current.y) * (newZ / zoomRef.current);
    zoomRef.current = newZ;
    setZoom(newZ);
    scheduleRender();
  }, [scheduleRender]);

  const navigateTo = useCallback((col, row) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    zoomRef.current = 2.2;
    const cs = CELL * 2.2;
    panRef.current = {
      x: canvas.width / 2  - col * cs - cs / 2,
      y: canvas.height / 2 - row * cs - cs / 2,
    };
    setZoom(2.2);
    scheduleRender();
  }, [scheduleRender]);

  return {
    canvasRef,
    zoom,
    hoveredCell,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onWheel,
    fitView,
    zoomBy,
    navigateTo,
    scheduleRender,
  };
};

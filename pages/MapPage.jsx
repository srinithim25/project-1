import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Search, Grid, ZoomIn, ZoomOut, Maximize2, Thermometer } from 'lucide-react';
import { useWarehouseCanvas } from '../hooks/useWarehouseCanvas';
import { useSocket } from '../hooks/useSocket';
import CellDetailPanel from '../components/CellDetailPanel';
import { getWarehouseCells, bookCell, releaseCell, occupyCell, createWarehouse } from '../api/api';
import { useToast } from '../components/Toast';

const AISLE_COLS = [9,10,19,20,29,30];
const AISLE_ROWS = [6,7,14,15,22,23];
const STATUSES = ['available','available','available','occupied','reserved'];
const WAREHOUSE_ID = 'WH-001';

function generateMockCells() {
  const cells = [];
  for (let r = 0; r < 30; r++) {
    for (let c = 0; c < 40; c++) {
      const isAisle = AISLE_COLS.includes(c) || AISLE_ROWS.includes(r);
      cells.push({
        warehouseId: WAREHOUSE_ID, col: c, row: r,
        cellId: `${WAREHOUSE_ID}_${c}_${r}`,
        isAisle,
        status: isAisle ? 'aisle' : STATUSES[Math.floor(Math.random() * STATUSES.length)],
        capacity: isAisle ? 0 : Math.floor(Math.random() * 800 + 200),
        traffic: Math.floor(Math.random() * 100),
        zone: String.fromCharCode(65 + Math.floor(r / 6)),
        aisle: String(c + 1).padStart(2, '0'),
      });
    }
  }
  return cells;
}

export default function MapPage() {
  const [cells, setCells] = useState(() => generateMockCells());
  const [selectedCell, setSelectedCell] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [usingDB, setUsingDB] = useState(false);
  const canvasAreaRef = useRef(null);
  const toast = useToast();

  // Try to load from API; if warehouse doesn't exist, seed it first
  useEffect(() => {
    const loadCells = async () => {
      try {
        const res = await getWarehouseCells(WAREHOUSE_ID);
        if (res.data?.length > 0) {
          // MongoDB cells don't have isAisle flag — recompute it
          const enriched = res.data.map(c => ({
            ...c,
            isAisle: AISLE_COLS.includes(c.col) || AISLE_ROWS.includes(c.row),
          }));
          setCells(enriched);
          setUsingDB(true);
        } else {
          // Warehouse exists but no cells — seed it
          await seedWarehouse();
        }
      } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 500) {
          await seedWarehouse();
        }
        // else keep mock data silently
      }
    };

    const seedWarehouse = async () => {
      try {
        await createWarehouse({
          warehouseId: WAREHOUSE_ID,
          name: 'Chennai Central',
          location: 'Chennai, TN',
          cols: 40,
          rows: 30,
        });
        const res = await getWarehouseCells(WAREHOUSE_ID);
        if (res.data?.length > 0) {
          const enriched = res.data.map(c => ({
            ...c,
            isAisle: AISLE_COLS.includes(c.col) || AISLE_ROWS.includes(c.row),
          }));
          setCells(enriched);
          setUsingDB(true);
        }
      } catch {
        // Keep mock data — server might be offline
      }
    };

    loadCells();
  }, []);

  // Socket real-time sync
  const onCellUpdate = useCallback((updatedCell) => {
    const enriched = { ...updatedCell, isAisle: AISLE_COLS.includes(updatedCell.col) || AISLE_ROWS.includes(updatedCell.row) };
    setCells(prev => prev.map(c => c.cellId === enriched.cellId ? { ...c, ...enriched } : c));
    setSelectedCell(prev => prev?.cellId === enriched.cellId ? { ...prev, ...enriched } : prev);
  }, []);

  const { emitOptimistic } = useSocket(WAREHOUSE_ID, onCellUpdate);

  const {
    canvasRef, zoom, hoveredCell,
    onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onWheel,
    fitView, zoomBy, navigateTo,
  } = useWarehouseCanvas(cells, showHeatmap, showGrid);

  // Resize canvas to fill container
  useEffect(() => {
    const area = canvasAreaRef.current;
    const canvas = canvasRef.current;
    if (!area || !canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = area.clientWidth;
      canvas.height = area.clientHeight;
      fitView(area.clientWidth, area.clientHeight);
    });
    ro.observe(area);
    return () => ro.disconnect();
  }, [fitView, canvasRef]);

  // Search
  const handleSearch = (e) => {
    if (e.key !== 'Enter') return;
    const q = searchVal.trim().toLowerCase();
    // Support "col,row" format like "5,3"
    const coordMatch = q.match(/^(\d+)[,\s]+(\d+)$/);
    let found;
    if (coordMatch) {
      found = cells.find(c => c.col === +coordMatch[1] && c.row === +coordMatch[2] && !c.isAisle);
    } else {
      found = cells.find(c => c.cellId?.toLowerCase().includes(q));
    }
    if (found) {
      navigateTo(found.col, found.row);
      setSelectedCell(found);
      toast.success(`Navigated to ${found.cellId}`, 'Cell Found');
    } else {
      toast.warning(`No cell matching "${searchVal}"`, 'Not Found');
    }
    setSearchVal('');
  };

  // Cell click
  const handleCanvasMouseUp = useCallback((e) => {
    const clicked = onMouseUp(e);
    if (clicked) setSelectedCell({ ...clicked });
  }, [onMouseUp]);

  // ── Book: try API first, fall back to local state update ──
  const handleBook = async (cell) => {
    if (cell.isAisle) return;
    setActionLoading(true);
    try {
      if (usingDB) {
        const res = await bookCell(WAREHOUSE_ID, cell.cellId);
        const updated = { ...res.data.cell, isAisle: false };
        setCells(prev => prev.map(c => c.cellId === updated.cellId ? updated : c));
        setSelectedCell(updated);
        emitOptimistic(updated);
      } else {
        // Local-only mode (no server)
        const updated = { ...cell, status: 'mine' };
        setCells(prev => prev.map(c => c.cellId === updated.cellId ? updated : c));
        setSelectedCell(updated);
      }
      toast.success(`Cell ${cell.cellId} booked!`, 'Booking Confirmed');
    } catch (err) {
      const msg = err.response?.data?.message || 'Booking failed';
      // If it's a 409 conflict, show it clearly
      if (err.response?.status === 409) {
        toast.error('This cell is already booked by someone else.', 'Conflict');
      } else {
        toast.error(msg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async (cell) => {
    setActionLoading(true);
    try {
      if (usingDB) {
        const res = await releaseCell(WAREHOUSE_ID, cell.cellId);
        const updated = { ...res.data.cell, isAisle: false };
        setCells(prev => prev.map(c => c.cellId === updated.cellId ? updated : c));
        setSelectedCell(updated);
        emitOptimistic(updated);
      } else {
        const updated = { ...cell, status: 'available' };
        setCells(prev => prev.map(c => c.cellId === updated.cellId ? updated : c));
        setSelectedCell(updated);
      }
      toast.success(`Cell ${cell.cellId} released.`, 'Space Released');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Release failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOccupy = async (cell) => {
    setActionLoading(true);
    try {
      if (usingDB) {
        const res = await occupyCell(WAREHOUSE_ID, cell.cellId);
        const updated = { ...res.data.cell, isAisle: false };
        setCells(prev => prev.map(c => c.cellId === updated.cellId ? updated : c));
        setSelectedCell(updated);
        emitOptimistic(updated);
      } else {
        const updated = { ...cell, status: 'occupied' };
        setCells(prev => prev.map(c => c.cellId === updated.cellId ? updated : c));
        setSelectedCell(updated);
      }
      toast.info(`Cell ${cell.cellId} marked as occupied.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const available = cells.filter(c => !c.isAisle && c.status === 'available').length;
  const occupied  = cells.filter(c => !c.isAisle && c.status === 'occupied').length;
  const mine      = cells.filter(c => !c.isAisle && c.status === 'mine').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-14 bg-ink-800 border-b border-ink-700 flex items-center px-6 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 bg-ink-700 border border-ink-600 rounded-lg px-3 py-1.5 flex-1 max-w-72">
          <Search size={13} className="text-ink-500" />
          <input
            className="bg-transparent outline-none text-xs text-ink-200 placeholder-ink-600 w-full font-mono"
            placeholder="Search cell ID or col,row (e.g. 5,3)…"
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>

        <div className="flex items-center gap-1">
          {[
            { label: 'Heatmap', icon: Thermometer, active: showHeatmap, toggle: () => setShowHeatmap(p => !p) },
            { label: 'Grid',    icon: Grid,        active: showGrid,    toggle: () => setShowGrid(p => !p) },
          ].map(({ label, icon: Icon, active, toggle }) => (
            <button
              key={label}
              onClick={toggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all
                ${active ? 'bg-teal-500/10 text-teal-400 border border-teal-500/25' : 'text-ink-500 hover:text-ink-300 hover:bg-ink-700'}`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4">
          {/* DB indicator */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <div className={`w-1.5 h-1.5 rounded-full ${usingDB ? 'bg-teal-400' : 'bg-yellow-400'}`} />
            <span className="text-ink-500">{usingDB ? 'MongoDB' : 'Local'}</span>
          </div>
          {/* Legend */}
          {[
            { color: '#14b8a6', label: 'Available' },
            { color: '#ef4444', label: 'Occupied' },
            { color: '#0ea5e9', label: 'Mine' },
            { color: '#7c3aed', label: 'Reserved' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-ink-500">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden bg-ink-900" ref={canvasAreaRef}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 cursor-crosshair"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={onMouseLeave}
            onWheel={onWheel}
          />

          {/* Zoom controls */}
          <div className="absolute bottom-5 right-5 flex flex-col gap-1.5">
            <button className="w-8 h-8 card flex items-center justify-center hover:border-teal-500/50 hover:text-teal-400 transition-all text-ink-400" onClick={() => zoomBy(1.25)}>
              <ZoomIn size={14} />
            </button>
            <div className="w-8 h-6 card flex items-center justify-center text-[9px] font-mono text-ink-500">
              {Math.round(zoom * 100)}%
            </div>
            <button className="w-8 h-8 card flex items-center justify-center hover:border-teal-500/50 hover:text-teal-400 transition-all text-ink-400" onClick={() => zoomBy(0.8)}>
              <ZoomOut size={14} />
            </button>
            <button className="w-8 h-8 card flex items-center justify-center hover:border-teal-500/50 hover:text-teal-400 transition-all text-ink-400" onClick={() => { const a = canvasAreaRef.current; fitView(a.clientWidth, a.clientHeight); }}>
              <Maximize2 size={12} />
            </button>
          </div>

          {/* Coordinates */}
          <div className="absolute bottom-5 left-5 card px-3 py-1.5 text-[10px] font-mono text-ink-500 flex items-center gap-3">
            {hoveredCell ? (
              <>
                <span>Col <span className="text-teal-400">{hoveredCell.col}</span></span>
                <span>·</span>
                <span>Row <span className="text-teal-400">{hoveredCell.row}</span></span>
                <span>·</span>
                <span className="capitalize" style={{ color: ({ available:'#14b8a6',occupied:'#ef4444',mine:'#0ea5e9',reserved:'#7c3aed' })[hoveredCell.status] || '#64748b' }}>
                  {hoveredCell.status}
                </span>
              </>
            ) : (
              <span>Hover a cell to inspect · Click to select</span>
            )}
          </div>

          {/* Stats pill */}
          <div className="absolute top-4 right-4 card px-4 py-2 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse-slow" />
              <span className="text-ink-400">Live</span>
            </div>
            <span className="text-ink-600">|</span>
            <span className="text-ink-400">Avail: <span className="text-teal-400 font-mono">{available}</span></span>
            <span className="text-ink-400">Occ: <span className="text-red-400 font-mono">{occupied}</span></span>
            <span className="text-ink-400">Mine: <span className="text-sky-400 font-mono">{mine}</span></span>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 bg-ink-800 border-l border-ink-700 p-5 overflow-y-auto flex-shrink-0">
          <div className="label mb-4">Cell Details</div>
          <CellDetailPanel
            cell={selectedCell}
            warehouseId={WAREHOUSE_ID}
            onBook={handleBook}
            onRelease={handleRelease}
            onOccupy={handleOccupy}
            loading={actionLoading}
          />
        </div>
      </div>
    </div>
  );
}
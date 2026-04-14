import React, { useState } from 'react';
import { Box, MapPin, Weight, Thermometer, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const STATUS_META = {
  available: { color: '#14b8a6', label: 'Available',  icon: CheckCircle },
  occupied:  { color: '#ef4444', label: 'Occupied',   icon: XCircle },
  mine:      { color: '#0ea5e9', label: 'My Booking', icon: CheckCircle },
  reserved:  { color: '#7c3aed', label: 'Reserved',   icon: AlertCircle },
};

export default function CellDetailPanel({ cell, warehouseId, onBook, onRelease, onOccupy, loading }) {
  const [confirm, setConfirm] = useState(null);

  if (!cell) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-16">
        <div className="w-16 h-16 rounded-full bg-ink-700 flex items-center justify-center">
          <MapPin size={28} className="text-ink-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink-400">No Cell Selected</p>
          <p className="text-xs text-ink-600 mt-1">Click any cell on the map to inspect it.</p>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[cell.status] || STATUS_META.available;
  const StatusIcon = meta.icon;

  const handleAction = async (action) => {
    setConfirm(null);
    if (action === 'book') await onBook(cell);
    if (action === 'release') await onRelease(cell);
    if (action === 'occupy') await onOccupy(cell);
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}18` }}>
          <Box size={18} style={{ color: meta.color }} />
        </div>
        <div>
          <h4 className="font-semibold text-ink-100 text-sm font-mono">{cell.cellId}</h4>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StatusIcon size={10} style={{ color: meta.color }} />
            <span className="text-[11px]" style={{ color: meta.color }}>{meta.label}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: MapPin,       label: 'Position',   val: `${cell.col}, ${cell.row}` },
          { icon: Box,          label: 'Zone',        val: `Zone ${cell.zone || 'A'}` },
          { icon: Weight,       label: 'Capacity',   val: `${cell.capacity} pcs` },
          { icon: Thermometer,  label: 'Traffic',    val: `${cell.traffic}%` },
        ].map(({ icon: I, label, val }) => (
          <div key={label} className="bg-ink-700/50 rounded-lg p-3 border border-ink-600/40">
            <div className="flex items-center gap-1.5 mb-1">
              <I size={10} className="text-ink-500" />
              <span className="text-[9px] text-ink-500 uppercase tracking-wider">{label}</span>
            </div>
            <span className="text-xs font-medium text-ink-200 font-mono">{val}</span>
          </div>
        ))}
      </div>

      {/* Specs */}
      <div className="bg-ink-700/30 rounded-lg p-3 border border-ink-600/30 space-y-2">
        <div className="label mb-2">Specifications</div>
        {[
          ['Max Weight', '2,500 lbs'],
          ['Dimensions', '48" × 40"'],
          ['Climate Ctrl', 'Yes'],
          ['Aisle', cell.aisle || '01'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between items-center text-xs">
            <span className="text-ink-500">{k}</span>
            <span className="text-ink-200 font-mono">{v}</span>
          </div>
        ))}
      </div>

      {/* Last updated */}
      <div className="flex items-center gap-1.5 text-[10px] text-ink-600">
        <Clock size={10} />
        Updated {cell.updatedAt ? new Date(cell.updatedAt).toLocaleString() : 'recently'}
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {cell.status === 'available' && (
          <button
            className="btn-primary w-full"
            onClick={() => handleAction('book')}
            disabled={loading}
          >
            {loading ? 'Booking…' : 'Book This Space'}
          </button>
        )}
        {cell.status === 'mine' && (
          <>
            <button className="w-full py-2 rounded-lg text-sm font-medium bg-ink-600 hover:bg-ink-500 text-ink-200 transition-all" onClick={() => handleAction('occupy')} disabled={loading}>
              Mark as Occupied
            </button>
            <button className="btn-danger w-full" onClick={() => handleAction('release')} disabled={loading}>
              {loading ? 'Releasing…' : 'Release Space'}
            </button>
          </>
        )}
        {cell.status === 'occupied' && (
          <button className="btn-danger w-full" onClick={() => handleAction('release')} disabled={loading}>
            Force Release
          </button>
        )}
      </div>
    </div>
  );
}

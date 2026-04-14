import React, { useEffect, useState } from 'react';
import { Plus, Truck, Search, ChevronDown, Check } from 'lucide-react';
import { getShipments, createShipment, updateShipmentStatus } from '../api/api';
import { useToast } from '../components/Toast';

const ALL_STATUSES = ['pending', 'in_transit', 'arrived', 'dispatched', 'on_hold'];

const STATUS_STYLE = {
  pending:    'bg-sky-500/15 text-sky-400 border-sky-500/30',
  in_transit: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  arrived:    'bg-teal-500/15 text-teal-400 border-teal-500/30',
  dispatched: 'bg-ink-600/60 text-ink-300 border-ink-500/30',
  on_hold:    'bg-red-500/15 text-red-400 border-red-500/30',
};

const TYPE_ICON = { inbound: '↓', outbound: '↑', internal: '↔' };

// Inline status dropdown for each row
function StatusDropdown({ shipmentId, current, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSelect = async (status) => {
    if (status === current) { setOpen(false); return; }
    setLoading(true);
    setOpen(false);
    await onUpdate(shipmentId, status);
    setLoading(false);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(p => !p)}
        disabled={loading}
        className={`badge border flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity ${STATUS_STYLE[current] || ''}`}
      >
        {loading ? '…' : current?.replace('_', ' ')}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 card shadow-xl shadow-black/40 py-1 min-w-[130px]">
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => handleSelect(s)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] hover:bg-ink-700 transition-colors text-left"
              >
                <span className={`capitalize ${s === current ? 'text-teal-400 font-medium' : 'text-ink-300'}`}>
                  {s.replace('_', ' ')}
                </span>
                {s === current && <Check size={10} className="text-teal-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ type: 'inbound', description: '', zone: '', weight: '', pallets: '1' });
  const toast = useToast();

  const load = async () => {
    try {
      const res = await getShipments({ warehouseId: 'WH-001' });
      setShipments(res.data);
    } catch {
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createShipment({
        ...form,
        warehouseId: 'WH-001',
        weight: +form.weight || 0,
        pallets: +form.pallets || 1,
      });
      toast.success('Shipment created successfully!', 'New Shipment');
      setShowForm(false);
      setForm({ type: 'inbound', description: '', zone: '', weight: '', pallets: '1' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create shipment');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const res = await updateShipmentStatus(id, status);
      // Update locally without full reload
      setShipments(prev => prev.map(s => s._id === id ? { ...s, status: res.data.status } : s));
      toast.success(`Status updated to "${status.replace('_', ' ')}"`, 'Shipment Updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
      load(); // re-sync on failure
    }
  };

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const filtered = shipments.filter(s =>
    !search ||
    s.shipmentId?.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase()) ||
    s.zone?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-ink-100">Shipments</h1>
          <p className="text-sm text-ink-500 mt-0.5">Track all inbound and outbound logistics</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(p => !p)}>
          <Plus size={14} />
          New Shipment
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card-elevated p-6 animate-fade-up">
          <h3 className="font-semibold text-ink-200 mb-4">Create New Shipment</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5 block">Type</label>
              <select className="input" value={form.type} onChange={set('type')}>
                <option value="inbound">↓ Inbound</option>
                <option value="outbound">↑ Outbound</option>
                <option value="internal">↔ Internal</option>
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Zone</label>
              <input className="input" placeholder="e.g. Zone A" value={form.zone} onChange={set('zone')} />
            </div>
            <div className="col-span-2">
              <label className="label mb-1.5 block">Description *</label>
              <input
                className="input"
                placeholder="General goods, electronics, perishables…"
                value={form.description}
                onChange={set('description')}
                required
              />
            </div>
            <div>
              <label className="label mb-1.5 block">Weight (kg)</label>
              <input className="input" type="number" min="0" placeholder="500" value={form.weight} onChange={set('weight')} />
            </div>
            <div>
              <label className="label mb-1.5 block">Pallets</label>
              <input className="input" type="number" min="1" value={form.pallets} onChange={set('pallets')} />
            </div>
            <div className="col-span-2 flex gap-3 justify-end pt-2">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Shipment</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card-elevated overflow-hidden animate-fade-up" style={{ animationDelay: '0.05s' }}>
        <div className="px-6 py-4 border-b border-ink-700 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-ink-700 rounded-lg px-3 py-1.5 flex-1 max-w-72">
            <Search size={12} className="text-ink-500" />
            <input
              className="bg-transparent outline-none text-xs text-ink-200 placeholder-ink-600 w-full"
              placeholder="Search by ID, description, zone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs text-ink-600 ml-auto">{filtered.length} shipments</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-ink-600 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Truck size={32} className="text-ink-700 mx-auto mb-3" />
            <p className="text-sm text-ink-500">
              {shipments.length === 0 ? 'No shipments yet. Create the first one.' : 'No results match your search.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ink-700">
                {['Shipment ID', 'Type', 'Description', 'Zone', 'Pallets', 'Status', 'Updated'].map(h => (
                  <th key={h} className="px-5 py-3 label">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/40">
              {filtered.map(s => (
                <tr key={s._id} className="hover:bg-ink-700/20 transition-colors group">
                  <td className="px-5 py-3.5 font-mono text-xs text-teal-400">{s.shipmentId}</td>
                  <td className="px-5 py-3.5 text-xs text-ink-300">
                    <span className="font-mono text-ink-500 mr-1">{TYPE_ICON[s.type]}</span>
                    <span className="capitalize">{s.type}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ink-400 max-w-[180px] truncate" title={s.description}>
                    {s.description}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ink-400">{s.zone || '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-ink-400 font-mono">{s.pallets}</td>
                  <td className="px-5 py-3.5">
                    <StatusDropdown
                      shipmentId={s._id}
                      current={s.status}
                      onUpdate={handleStatusUpdate}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ink-600">
                    {new Date(s.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
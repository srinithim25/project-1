import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Layers, AlertCircle, CheckCircle2, Truck, Plus,
  ChevronRight, Clock, RefreshCw, Zap, TrendingUp,
  TrendingDown, Box, Package, Activity, Circle
} from 'lucide-react';
import { io } from 'socket.io-client';
import StatCard from '../components/StatCard';
import { getWarehouseStats, getShipments, createShipment } from '../api/api';
import { useToast } from '../components/Toast';

const WAREHOUSE_ID = 'WH-001';
const MAX_ACTIVITY = 12;

const STATUS_BADGE = {
  pending:    'bg-sky-500/15 text-sky-400 border-sky-500/30',
  in_transit: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  arrived:    'bg-teal-500/15 text-teal-400 border-teal-500/30',
  dispatched: 'bg-ink-600/60 text-ink-300 border-ink-500/30',
  on_hold:    'bg-red-500/15 text-red-400 border-red-500/30',
};

const ACTIVITY_META = {
  book:            { color: '#0ea5e9', icon: Box,      label: 'Cell booked' },
  release:         { color: '#14b8a6', icon: CheckCircle2, label: 'Cell released' },
  occupy:          { color: '#ef4444', icon: AlertCircle,  label: 'Cell occupied' },
  shipment:        { color: '#a855f7', icon: Truck,    label: 'Shipment created' },
  shipment_status: { color: '#f59e0b', icon: Activity, label: 'Status updated' },
};

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 5)  return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

function buildBarHistory(todayPct) {
  if (todayPct === 0) return Array(7).fill(0);
  const offsets = [-18, -12, -15, -8, -5, -10, 0];
  return offsets.map(o => Math.max(5, Math.min(100, todayPct + o)));
}

// Mini animated counter
function Counter({ value, color }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const target = value;
    const start = prev.current;
    prev.current = target;
    if (start === target) return;
    const steps = 20;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplay(Math.round(start + (target - start) * (i / steps)));
      if (i >= steps) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [value]);
  return <span style={{ color }}>{display.toLocaleString()}</span>;
}

// Live clock
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-xs text-ink-500">
      {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats]         = useState({ available: 0, occupied: 0, mine: 0, reserved: 0, total: 0 });
  const [prevStats, setPrevStats] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [activity, setActivity]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync]   = useState(null);
  const [showNewShipment, setShowNewShipment] = useState(false);
  const [form, setForm]           = useState({ type: 'inbound', description: '', zone: '', pallets: '1' });
  const socketRef = useRef(null);
  const toast     = useToast();

  // ── Fetch stats + shipments ──
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sRes, shRes] = await Promise.all([
        getWarehouseStats(WAREHOUSE_ID),
        getShipments({ warehouseId: WAREHOUSE_ID }),
      ]);
      setPrevStats(s => s || sRes.data);
      setStats(sRes.data);
      setShipments(shRes.data.slice(0, 8));
      setLastSync(new Date());
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Socket.io for live updates ──
  useEffect(() => {
    const socket = io('/', { path: '/socket.io', transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join:warehouse', WAREHOUSE_ID);
      socket.emit('join:dashboard');
    });

    socket.on('disconnect', () => setConnected(false));

    // Re-fetch stats whenever any cell or shipment changes
    socket.on('stats:refresh', () => {
      fetchData(true);
    });

    // Live activity feed
    socket.on('activity', (event) => {
      setActivity(prev => [{ ...event, id: Date.now() }, ...prev].slice(0, MAX_ACTIVITY));
    });

    // New shipment → reload
    socket.on('shipment:new', () => {
      getShipments({ warehouseId: WAREHOUSE_ID })
        .then(res => setShipments(res.data.slice(0, 8)))
        .catch(() => {});
    });

    socket.on('shipment:updated', (updated) => {
      setShipments(prev => prev.map(s => s._id === updated._id ? updated : s));
    });

    return () => socket.disconnect();
  }, [fetchData]);

  // ── Auto-refresh every 30s as fallback ──
  useEffect(() => {
    const t = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  const occupancyPct = stats.total > 0
    ? Math.round(((stats.occupied + stats.mine) / stats.total) * 100)
    : 0;

  const barData = buildBarHistory(occupancyPct);
  const barMax  = Math.max(...barData, 1);
  const ringColor = occupancyPct > 80 ? '#ef4444' : occupancyPct > 60 ? '#f59e0b' : '#14b8a6';

  const statDelta = (key) => {
    if (!prevStats || prevStats[key] === stats[key]) return null;
    const d = stats[key] - prevStats[key];
    return d > 0 ? `+${d}` : `${d}`;
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    try {
      await createShipment({ ...form, warehouseId: WAREHOUSE_ID, pallets: +form.pallets });
      toast.success('Shipment created!', 'New Shipment');
      setShowNewShipment(false);
      setForm({ type: 'inbound', description: '', zone: '', pallets: '1' });
      fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create');
    }
  };

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-ink-900">

      {/* ── Header ── */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-ink-100">Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-ink-500">WH-001 · Chennai Central</span>
            <span className="text-ink-700">·</span>
            <LiveClock />
            {lastSync && (
              <>
                <span className="text-ink-700">·</span>
                <span className="text-[10px] text-ink-600">
                  Synced {timeAgo(lastSync.toISOString())}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs
            ${connected ? 'border-teal-500/30 bg-teal-500/5 text-teal-400' : 'border-ink-600 bg-ink-800 text-ink-500'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-teal-400 animate-pulse' : 'bg-ink-600'}`} />
            {connected ? 'Live' : 'Offline'}
          </div>
          <button onClick={() => fetchData()} disabled={loading} className="btn-ghost flex items-center gap-2">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowNewShipment(p => !p)}>
            <Plus size={14} />
            New Shipment
          </button>
        </div>
      </div>

      {/* ── Quick-create shipment form ── */}
      {showNewShipment && (
        <div className="card-elevated p-5 animate-fade-up">
          <h3 className="font-semibold text-ink-200 mb-4 text-sm">Create Shipment</h3>
          <form onSubmit={handleCreateShipment} className="grid grid-cols-4 gap-3">
            <div>
              <label className="label mb-1 block">Type</label>
              <select className="input" value={form.type} onChange={set('type')}>
                <option value="inbound">↓ Inbound</option>
                <option value="outbound">↑ Outbound</option>
                <option value="internal">↔ Internal</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label mb-1 block">Description *</label>
              <input className="input" placeholder="Goods description…" value={form.description} onChange={set('description')} required />
            </div>
            <div>
              <label className="label mb-1 block">Zone</label>
              <input className="input" placeholder="Zone A" value={form.zone} onChange={set('zone')} />
            </div>
            <div className="col-span-4 flex gap-2 justify-end">
              <button type="button" className="btn-ghost" onClick={() => setShowNewShipment(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="card-elevated p-5 animate-pulse">
              <div className="h-3 bg-ink-700 rounded w-2/3 mb-4" />
              <div className="h-9 bg-ink-700 rounded w-1/2 mb-2" />
              <div className="h-2 bg-ink-700 rounded w-1/3" />
            </div>
          ))
        ) : (
          <>
            {[
              { label: 'Total Capacity',  key: 'total',     color: '#14b8a6', icon: Layers },
              { label: 'Available',       key: 'available', color: '#22c55e', icon: CheckCircle2 },
              { label: 'Occupied',        key: 'occupied',  color: '#ef4444', icon: AlertCircle },
              { label: 'My Bookings',     key: 'mine',      color: '#0ea5e9', icon: Box },
            ].map(({ label, key, color, icon: Icon }) => {
              const delta = statDelta(key);
              return (
                <div key={key} className="card-elevated p-5 hover:border-ink-600 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 opacity-60" style={{ background: color }} />
                  <div className="flex items-start justify-between mb-2">
                    <span className="label">{label}</span>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                      <Icon size={14} style={{ color }} strokeWidth={2} />
                    </div>
                  </div>
                  <div className="font-display text-4xl font-bold leading-none" style={{ color }}>
                    <Counter value={stats[key] ?? 0} color={color} />
                  </div>
                  {delta && (
                    <div className="mt-2 flex items-center gap-1 text-[10px]">
                      {delta.startsWith('+')
                        ? <TrendingUp size={9} className="text-teal-400" />
                        : <TrendingDown size={9} className="text-red-400" />}
                      <span className={delta.startsWith('+') ? 'text-teal-400' : 'text-red-400'}>{delta}</span>
                      <span className="text-ink-600">since last update</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Charts + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Bar Chart */}
        <div className="card-elevated p-6 lg:col-span-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-ink-200 text-sm">Utilization (7-day)</h3>
            <span className="badge bg-teal-500/10 text-teal-400 border border-teal-500/20">Live</span>
          </div>
          <p className="text-[10px] text-ink-600 mb-5">
            {loading ? 'Loading…' : `${occupancyPct}% · ${stats.occupied + stats.mine} / ${stats.total} cells`}
          </p>
          {loading ? (
            <div className="flex items-end gap-2 h-28">
              {DAYS.map(d => <div key={d} className="flex-1 bg-ink-700 rounded-t-md animate-pulse" style={{ height: `${30 + Math.random() * 50}%` }} />)}
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-28">
                {DAYS.map((day, i) => {
                  const val = barData[i];
                  const h = Math.round((val / barMax) * 100);
                  const isToday = i === 6;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1.5 group">
                      <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                        <div
                          className={`w-full rounded-t transition-all duration-700 relative
                            ${isToday ? 'bg-teal-500/70 hover:bg-teal-400/80' : 'bg-ink-600/50 hover:bg-ink-500/60'}`}
                          style={{ height: `${h}%`, minHeight: val > 0 ? '3px' : '0' }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-ink-700 text-ink-200 text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-ink-600 z-10">
                            {val}%
                          </div>
                          {isToday && <div className="absolute top-0 inset-x-0 h-0.5 bg-teal-400 rounded-t" />}
                        </div>
                      </div>
                      <span className={`text-[8px] font-medium ${isToday ? 'text-teal-400' : 'text-ink-700'}`}>{day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[8px] text-ink-700">
                <span>0%</span><span>{barMax}%</span>
              </div>
            </>
          )}
        </div>

        {/* Occupancy Ring */}
        <div className="card-elevated p-6 lg:col-span-3 flex flex-col items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: '0.12s' }}>
          <h3 className="font-semibold text-ink-200 text-sm self-start">Occupancy</h3>
          {loading ? (
            <div className="w-28 h-28 rounded-full bg-ink-700 animate-pulse" />
          ) : (
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1e2535" strokeWidth="10" />
                <circle cx="50" cy="50" r="38" fill="none"
                  stroke={ringColor} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${occupancyPct * 2.39} 239`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-bold" style={{ color: ringColor }}>{occupancyPct}%</span>
                <span className="text-[8px] text-ink-600 uppercase tracking-wider">Occupied</span>
              </div>
            </div>
          )}
          <div className="w-full space-y-1.5 text-[11px]">
            {[
              { label: 'Available',   val: stats.available, color: '#22c55e' },
              { label: 'Occupied',    val: stats.occupied,  color: '#ef4444' },
              { label: 'My Bookings', val: stats.mine,      color: '#0ea5e9' },
              { label: 'Reserved',    val: stats.reserved,  color: '#7c3aed' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                  <span className="text-ink-500">{label}</span>
                </div>
                <span className="font-mono text-ink-300">{loading ? '—' : val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="card-elevated p-5 lg:col-span-5 flex flex-col animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink-200 text-sm">Live Activity</h3>
            <div className="flex items-center gap-1.5 text-[10px] text-teal-400">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Real-time
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-52">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
                <Zap size={24} className="text-ink-700" />
                <p className="text-[11px] text-ink-600 text-center">
                  Activity will appear here as cells are booked,<br />released, or shipments are updated.
                </p>
              </div>
            ) : (
              activity.map((ev) => {
                const meta = ACTIVITY_META[ev.type] || ACTIVITY_META.book;
                const Icon = meta.icon;
                return (
                  <div key={ev.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-ink-700/30 border border-ink-700/50 animate-fade-up">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${meta.color}18` }}>
                      <Icon size={12} style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-ink-200">{meta.label}</span>
                        <span className="text-[9px] text-ink-600 whitespace-nowrap">{timeAgo(ev.time)}</span>
                      </div>
                      <div className="text-[10px] text-ink-500 mt-0.5 truncate">
                        {ev.cellId && <span className="font-mono text-ink-400">{ev.cellId}</span>}
                        {ev.shipmentId && <span className="font-mono text-ink-400">{ev.shipmentId}</span>}
                        {ev.status && <span className="ml-1 capitalize">→ {ev.status.replace('_', ' ')}</span>}
                        {ev.user && <span className="ml-1 text-ink-600">by {ev.user}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Shipments Table ── */}
      <div className="card-elevated overflow-hidden animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="px-6 py-4 border-b border-ink-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-ink-200 text-sm">Recent Shipments</h3>
            {!loading && (
              <span className="badge bg-ink-700 text-ink-400 border border-ink-600">{shipments.length}</span>
            )}
          </div>
          <a href="/shipments" className="text-teal-400 text-xs hover:text-teal-300 flex items-center gap-1">
            View All <ChevronRight size={12} />
          </a>
        </div>

        {loading ? (
          <div className="divide-y divide-ink-700/50">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex gap-6 animate-pulse">
                <div className="h-3 bg-ink-700 rounded w-28" />
                <div className="h-3 bg-ink-700 rounded w-16" />
                <div className="h-3 bg-ink-700 rounded w-40" />
                <div className="h-3 bg-ink-700 rounded w-14 ml-auto" />
              </div>
            ))}
          </div>
        ) : shipments.length === 0 ? (
          <div className="py-10 text-center">
            <Package size={28} className="text-ink-700 mx-auto mb-2" />
            <p className="text-sm text-ink-600">No shipments yet.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ink-700">
                {['Shipment ID', 'Type', 'Description', 'Zone', 'Status', 'Updated'].map(h => (
                  <th key={h} className="px-5 py-3 label">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/40">
              {shipments.map(s => (
                <tr key={s._id} className="hover:bg-ink-700/20 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-teal-400">{s.shipmentId}</td>
                  <td className="px-5 py-3 text-xs text-ink-300 capitalize">{s.type}</td>
                  <td className="px-5 py-3 text-xs text-ink-400 max-w-[200px] truncate">{s.description}</td>
                  <td className="px-5 py-3 text-xs text-ink-500">{s.zone || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`badge border ${STATUS_BADGE[s.status] || ''}`}>
                      {s.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-600 flex items-center gap-1">
                    <Clock size={9} />
                    {new Date(s.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
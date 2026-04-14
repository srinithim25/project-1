import React from 'react';
import { TrendingUp } from 'lucide-react';

export default function StatCard({ label, value, icon: Icon, color, trend, sub }) {
  return (
    <div className="card-elevated p-5 hover:border-ink-600 transition-all duration-200 group relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-0.5 opacity-60"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between mb-3">
        <span className="label">{label}</span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18` }}
        >
          <Icon size={16} style={{ color }} strokeWidth={2} />
        </div>
      </div>
      <div className="stat-num" style={{ color }}>{value?.toLocaleString() ?? '—'}</div>
      {(trend || sub) && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-500">
          {trend && (
            <>
              <TrendingUp size={10} className="text-teal-400" />
              <span className="text-teal-400">{trend}</span>
            </>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}

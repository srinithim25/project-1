import React from 'react';
import { Package, Warehouse } from 'lucide-react';

const Placeholder = ({ title, icon: Icon, desc }) => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="text-center space-y-4 animate-fade-up">
      <div className="w-20 h-20 rounded-2xl bg-ink-800 border border-ink-700 flex items-center justify-center mx-auto">
        <Icon size={36} className="text-ink-600" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-ink-300">{title}</h2>
        <p className="text-sm text-ink-600 mt-1">{desc}</p>
      </div>
      <div className="badge bg-teal-500/10 text-teal-500 border border-teal-500/20 inline-block">
        Coming Soon
      </div>
    </div>
  </div>
);

export const InventoryPage = () => (
  <Placeholder title="Inventory Management" icon={Package} desc="Track SKUs, stock levels, and pallet assignments." />
);

export const NetworkPage = () => (
  <Placeholder title="Global Network" icon={Warehouse} desc="View and manage multiple warehouse locations." />
);

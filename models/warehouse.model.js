const mongoose = require('mongoose');

const cellSchema = new mongoose.Schema({
  warehouseId: { type: String, required: true, index: true },
  col:         { type: Number, required: true },
  row:         { type: Number, required: true },
  cellId:      { type: String, required: true, unique: true }, // e.g. "WH001_12_7"
  status:      {
    type: String,
    enum: ['available', 'occupied', 'mine', 'reserved'],
    default: 'available'
  },
  bookedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  capacity:    { type: Number, default: 500 }, // pallets
  traffic:     { type: Number, default: 0, min: 0, max: 100 },
  zone:        { type: String, default: 'A' },
  aisle:       { type: String, default: '01' },
  notes:       { type: String, default: '' },
}, { timestamps: true });

// Compound index for spatial queries
cellSchema.index({ warehouseId: 1, col: 1, row: 1 }, { unique: true });

const warehouseSchema = new mongoose.Schema({
  warehouseId: { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  location:    { type: String, required: true },
  cols:        { type: Number, default: 40 },
  rows:        { type: Number, default: 30 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

const Cell      = mongoose.model('Cell', cellSchema);
const Warehouse = mongoose.model('Warehouse', warehouseSchema);

module.exports = { Cell, Warehouse };

const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  shipmentId:  { type: String, required: true, unique: true },
  warehouseId: { type: String, required: true, index: true },
  type:        { type: String, enum: ['inbound', 'outbound', 'internal'], default: 'inbound' },
  status:      { type: String, enum: ['pending', 'in_transit', 'arrived', 'dispatched', 'on_hold'], default: 'pending' },
  description: { type: String, default: '' },
  zone:        { type: String, default: '' },
  cellIds:     [{ type: String }], // list of cell IDs this shipment occupies
  eta:         { type: Date },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  weight:      { type: Number, default: 0 }, // kg
  pallets:     { type: Number, default: 1 },
}, { timestamps: true });

module.exports = mongoose.model('Shipment', shipmentSchema);

const router = require('express').Router();
const Shipment = require('../models/shipment.model');
const { getIO, broadcastStatsRefresh } = require('../socket/socket-handler');

router.get('/', async (req, res) => {
  const { warehouseId, status } = req.query;
  const filter = {};
  if (warehouseId) filter.warehouseId = warehouseId;
  if (status) filter.status = status;
  try {
    const shipments = await Shipment.find(filter).sort({ createdAt: -1 }).limit(100).populate('assignedTo', 'name email');
    res.json(shipments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  const { warehouseId, type, description, zone, eta, weight, pallets } = req.body;
  if (!warehouseId || !description) return res.status(400).json({ message: 'warehouseId and description are required' });
  const shipmentId = `SHP-${Date.now().toString(36).toUpperCase()}`;
  try {
    const shipment = await Shipment.create({ shipmentId, warehouseId, type, description, zone, eta, weight, pallets, createdBy: req.user._id });
    try {
      getIO().to(warehouseId).emit('shipment:new', shipment);
      getIO().to('dashboard').emit('activity', {
        type: 'shipment', shipmentId, warehouseId,
        user: req.user.name || 'Someone',
        shipType: type,
        time: new Date().toISOString(),
      });
      broadcastStatsRefresh(warehouseId);
    } catch {}
    res.status(201).json(shipment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'in_transit', 'arrived', 'dispatched', 'on_hold'];
  if (!validStatuses.includes(status)) return res.status(400).json({ message: `Invalid status` });
  try {
    const shipment = await Shipment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
    try {
      getIO().to(shipment.warehouseId).emit('shipment:updated', shipment);
      getIO().to('dashboard').emit('activity', {
        type: 'shipment_status', shipmentId: shipment.shipmentId,
        status, warehouseId: shipment.warehouseId,
        user: req.user.name || 'Someone',
        time: new Date().toISOString(),
      });
    } catch {}
    res.json(shipment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const shipment = await Shipment.findByIdAndDelete(req.params.id);
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
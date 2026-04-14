const router = require('express').Router();
const { Cell, Warehouse } = require('../models/warehouse.model');
const { getIO, broadcastStatsRefresh } = require('../socket/socket-handler');

router.get('/', async (req, res) => {
  try {
    res.json(await Warehouse.find({ isActive: true }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:warehouseId/cells', async (req, res) => {
  const { warehouseId } = req.params;
  const { minCol, maxCol, minRow, maxRow } = req.query;
  try {
    let filter = { warehouseId };
    if (minCol !== undefined) {
      filter.col = { $gte: +minCol, $lte: +maxCol };
      filter.row = { $gte: +minRow, $lte: +maxRow };
    }
    res.json(await Cell.find(filter).lean());
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:warehouseId/stats', async (req, res) => {
  const { warehouseId } = req.params;
  try {
    const stats = await Cell.aggregate([
      { $match: { warehouseId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const result = { available: 0, occupied: 0, mine: 0, reserved: 0 };
    stats.forEach(s => { if (result[s._id] !== undefined) result[s._id] = s.count; });
    result.total = Object.values(result).reduce((a, b) => a + b, 0);
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:warehouseId/cells/:cellId/book', async (req, res) => {
  const { warehouseId, cellId } = req.params;
  const userId = req.user._id;
  try {
    const updated = await Cell.findOneAndUpdate(
      { warehouseId, cellId, status: 'available' },
      { status: 'mine', bookedBy: userId },
      { new: true }
    );
    if (!updated) {
      const cell = await Cell.findOne({ warehouseId, cellId });
      if (!cell) return res.status(404).json({ message: 'Cell not found' });
      return res.status(409).json({ message: `Cell is already ${cell.status}` });
    }
    getIO().to(warehouseId).emit('cell:updated', updated);
    getIO().to('dashboard').emit('activity', {
      type: 'book', cellId, warehouseId,
      user: req.user.name || 'Someone',
      time: new Date().toISOString(),
    });
    broadcastStatsRefresh(warehouseId);
    res.json({ message: 'Cell booked successfully', cell: updated });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:warehouseId/cells/:cellId/release', async (req, res) => {
  const { warehouseId, cellId } = req.params;
  const userId = req.user._id;
  try {
    const isManager = req.user.role === 'manager';
    const condition = isManager ? { warehouseId, cellId } : { warehouseId, cellId, bookedBy: userId };
    const updated = await Cell.findOneAndUpdate(condition, { status: 'available', bookedBy: null }, { new: true });
    if (!updated) return res.status(403).json({ message: 'Cannot release: not your booking or cell not found' });
    getIO().to(warehouseId).emit('cell:updated', updated);
    getIO().to('dashboard').emit('activity', {
      type: 'release', cellId, warehouseId,
      user: req.user.name || 'Someone',
      time: new Date().toISOString(),
    });
    broadcastStatsRefresh(warehouseId);
    res.json({ message: 'Cell released', cell: updated });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:warehouseId/cells/:cellId/occupy', async (req, res) => {
  const { warehouseId, cellId } = req.params;
  try {
    const updated = await Cell.findOneAndUpdate({ warehouseId, cellId }, { status: 'occupied' }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Cell not found' });
    getIO().to(warehouseId).emit('cell:updated', updated);
    getIO().to('dashboard').emit('activity', {
      type: 'occupy', cellId, warehouseId,
      user: req.user.name || 'Someone',
      time: new Date().toISOString(),
    });
    broadcastStatsRefresh(warehouseId);
    res.json({ cell: updated });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  const { warehouseId, name, location, cols = 40, rows = 30 } = req.body;
  const AISLE_COLS = [9, 10, 19, 20, 29, 30];
  const AISLE_ROWS = [6, 7, 14, 15, 22, 23];
  try {
    const wh = await Warehouse.findOneAndUpdate(
      { warehouseId },
      { warehouseId, name, location, cols, rows, isActive: true },
      { upsert: true, new: true }
    );
    const existing = await Cell.countDocuments({ warehouseId });
    if (existing > 0) return res.status(200).json({ warehouse: wh, cellsCreated: 0, message: 'Already seeded' });
    const STATUSES = ['available', 'available', 'available', 'occupied', 'reserved'];
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isAisle = AISLE_COLS.includes(c) || AISLE_ROWS.includes(r);
        cells.push({
          warehouseId, col: c, row: r,
          cellId: `${warehouseId}_${c}_${r}`,
          status: isAisle ? 'available' : STATUSES[Math.floor(Math.random() * STATUSES.length)],
          capacity: isAisle ? 0 : Math.floor(Math.random() * 800 + 200),
          traffic: Math.floor(Math.random() * 100),
          zone: String.fromCharCode(65 + Math.floor(r / 6)),
          aisle: String(c + 1).padStart(2, '0'),
        });
      }
    }
    await Cell.insertMany(cells, { ordered: false });
    res.status(201).json({ warehouse: wh, cellsCreated: cells.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
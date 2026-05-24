const GirviRecord = require('../models/GirviRecord');
const Customer    = require('../models/Customer');
const path        = require('path');
const fs          = require('fs');

// ── Create Girvi Entry ────────────────────────────────────────────────────────
exports.createGirvi = async (req, res) => {
  try {
    const shopId = req.user._id;
    const { customerId, interestRate, girviDate, dueDate, notes } = req.body;

    let items = [];
    try { items = JSON.parse(req.body.items); } catch {
      return res.status(400).json({ message: 'Invalid items data' });
    }
    if (!items.length) return res.status(400).json({ message: 'At least one item is required' });

    const customer = await Customer.findOne({ _id: customerId, shop: shopId });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const files = req.files || {};
    items = items.map((item, idx) => {
      const itemPhotos = (files[`photos_${idx}`] || []).map(f => f.filename);
      return { ...item, photos: itemPhotos };
    });

    const girvi = await GirviRecord.create({
      shop:         shopId,
      customer:     customerId,
      items,
      interestRate: Number(interestRate),
      girviDate:    girviDate ? new Date(girviDate) : new Date(),
      dueDate:      dueDate   ? new Date(dueDate)   : null,
      notes,
    });

    const populated = await girvi.populate('customer', 'name phone customerCode');
    res.status(201).json({ message: 'Girvi entry created successfully', girvi: populated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Get All Girvi Records ─────────────────────────────────────────────────────
exports.getGirviRecords = async (req, res) => {
  try {
    const shopId = req.user._id;
    const { status, search, customerId, page = 1, limit = 20 } = req.query;

    const query = { shop: shopId };
    if (status)     query.status   = status;
    if (customerId) query.customer = customerId;
    if (search) {
      query.$or = [
        { ticketNumber:              { $regex: search, $options: 'i' } },
        { 'items.itemType':          { $regex: search, $options: 'i' } },
        { 'items.itemDescription':   { $regex: search, $options: 'i' } },
      ];
    }

    const total   = await GirviRecord.countDocuments(query);
    const records = await GirviRecord.find(query)
      .populate('customer', 'name phone customerCode address')
      .sort({ girviDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ records, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Get Single Girvi ──────────────────────────────────────────────────────────
exports.getGirvi = async (req, res) => {
  try {
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: req.user._id })
      .populate('customer');
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });
    res.json(girvi);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Update Girvi Entry ────────────────────────────────────────────────────────
exports.updateGirvi = async (req, res) => {
  try {
    const shopId = req.user._id;
    const girvi  = await GirviRecord.findOne({ _id: req.params.id, shop: shopId });
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });

    const { interestRate, girviDate, dueDate, notes, status } = req.body;

    // Parse items if provided
    let items = null;
    if (req.body.items) {
      try { items = JSON.parse(req.body.items); } catch {
        return res.status(400).json({ message: 'Invalid items data' });
      }
    }

    // Handle photo updates per item
    if (items) {
      const files = req.files || {};

      // Delete old photos that are no longer referenced
      items = items.map((item, idx) => {
        const newPhotos = (files[`photos_${idx}`] || []).map(f => f.filename);
        // existingPhotos: filenames the client wants to keep (sent as JSON array in existingPhotos_idx)
        let kept = [];
        try {
          kept = JSON.parse(req.body[`existingPhotos_${idx}`] || '[]');
        } catch { kept = []; }

        // Delete removed old photos from disk
        if (girvi.items[idx]) {
          const oldPhotos = girvi.items[idx].photos || [];
          oldPhotos.forEach(filename => {
            if (!kept.includes(filename)) {
              const filePath = path.join(__dirname, '..', 'uploads', filename);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          });
        }

        return { ...item, photos: [...kept, ...newPhotos] };
      });

      girvi.items = items;
    }

    if (interestRate !== undefined) girvi.interestRate = Number(interestRate);
    if (girviDate    !== undefined) girvi.girviDate    = new Date(girviDate);
    if (dueDate      !== undefined) girvi.dueDate      = dueDate ? new Date(dueDate) : null;
    if (notes        !== undefined) girvi.notes        = notes;
    if (status       !== undefined) girvi.status       = status;

    await girvi.save();
    const populated = await girvi.populate('customer', 'name phone customerCode');
    res.json({ message: 'Girvi record updated successfully', girvi: populated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Delete Girvi Entry ────────────────────────────────────────────────────────
exports.deleteGirvi = async (req, res) => {
  try {
    const shopId = req.user._id;
    const girvi  = await GirviRecord.findOne({ _id: req.params.id, shop: shopId });
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });

    // Delete associated photos from disk
    girvi.items.forEach(item => {
      (item.photos || []).forEach(filename => {
        const filePath = path.join(__dirname, '..', 'uploads', filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
        }
      });
    });

    await GirviRecord.deleteOne({ _id: req.params.id });
    res.json({ message: 'Girvi record deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Interest Calculator (live) ────────────────────────────────────────────────
exports.calculateInterest = async (req, res) => {
  try {
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: req.user._id });
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });

    const days     = girvi.daysElapsed;
    const interest = girvi.interestAccrued;
    const total    = parseFloat((girvi.totalAmountGiven + interest).toFixed(2));

    res.json({
      ticketNumber:    girvi.ticketNumber,
      principal:       girvi.totalAmountGiven,
      interestRate:    girvi.interestRate,
      interestType:    'per_day',
      daysElapsed:     days,
      interestAccrued: interest,
      totalDue:        total,
      items:           girvi.items,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Settle / Return ───────────────────────────────────────────────────────────
exports.settleGirvi = async (req, res) => {
  try {
    const { returnAmount, interestPaid, notes } = req.body;
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: req.user._id });
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });
    if (girvi.status === 'returned') return res.status(400).json({ message: 'Already returned' });

    girvi.status       = 'returned';
    girvi.returnDate   = new Date();
    girvi.returnAmount = Number(returnAmount);
    girvi.interestPaid = Number(interestPaid);
    if (notes) girvi.notes += '\n' + notes;
    await girvi.save();
    res.json({ message: 'Girvi settled successfully', girvi });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Partial Payment ───────────────────────────────────────────────────────────
exports.partialPayment = async (req, res) => {
  try {
    const { amount, note } = req.body;
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: req.user._id });
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });

    girvi.partialPayments.push({ date: new Date(), amount: Number(amount), note });
    girvi.interestPaid += Number(amount);
    girvi.status = 'partial';
    await girvi.save();
    res.json({ message: 'Partial payment saved', girvi });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Overdue ───────────────────────────────────────────────────────────────────
exports.getOverdueRecords = async (req, res) => {
  try {
    const shopId = req.user._id;
    const today  = new Date();
    const overdue = await GirviRecord.find({ shop: shopId, status: 'active', dueDate: { $lt: today } })
      .populate('customer', 'name phone');
    await GirviRecord.updateMany(
      { shop: shopId, status: 'active', dueDate: { $lt: today } },
      { status: 'overdue' }
    );
    res.json({ count: overdue.length, records: overdue });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
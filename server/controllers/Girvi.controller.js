const GirviRecord = require('../models/GirviRecord');
const Customer    = require('../models/Customer');

// ── Create Girvi Entry ────────────────────────────────────────────────────────
exports.createGirvi = async (req, res) => {
  try {
    const shopId = req.user._id;
    const {
      customerId, itemType, itemDescription, weightGrams, purity,
      estimatedValue, amountGiven, interestRate, interestType,
      girviDate, dueDate, notes,
    } = req.body;

    const customer = await Customer.findOne({ _id: customerId, shop: shopId });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const girviData = {
      shop: shopId,
      customer: customerId,
      itemType, itemDescription, weightGrams: Number(weightGrams),
      purity, estimatedValue: Number(estimatedValue),
      amountGiven: Number(amountGiven),
      interestRate: Number(interestRate), interestType,
      girviDate: girviDate ? new Date(girviDate) : new Date(),
      dueDate:   dueDate   ? new Date(dueDate)   : null,
      notes,
    };

    if (req.files && req.files['photos']) {
      girviData.photos = req.files['photos'].map(f => f.filename);
    }

    const girvi = await GirviRecord.create(girviData);
    const populated = await girvi.populate('customer', 'name phone customerCode');
    
    res.status(201).json({ message: 'Girvi entry created successfully', girvi: populated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Get All Girvi Records (with filters) ──────────────────────────────────────
exports.getGirviRecords = async (req, res) => {
  try {
    const shopId = req.user._id;
    const { status, search, customerId, page = 1, limit = 20 } = req.query;

    const query = { shop: shopId };
    if (status)     query.status = status;
    if (customerId) query.customer = customerId;
    if (search) {
      query.$or = [
        { ticketNumber:   { $regex: search, $options: 'i' } },
        { itemType:       { $regex: search, $options: 'i' } },
        { itemDescription:{ $regex: search, $options: 'i' } },
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

// ── Interest Calculator (live) ────────────────────────────────────────────────
exports.calculateInterest = async (req, res) => {
  try {
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: req.user._id });
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });

    const days     = girvi.daysElapsed;
    const interest = girvi.interestAccrued;
    const total    = parseFloat((girvi.amountGiven + interest).toFixed(2));

    res.json({
      ticketNumber:  girvi.ticketNumber,
      principal:     girvi.amountGiven,
      interestRate:  girvi.interestRate,
      interestType:  girvi.interestType,
      daysElapsed:   days,
      interestAccrued: interest,
      totalDue:      total,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Settle / Return Girvi ─────────────────────────────────────────────────────
exports.settleGirvi = async (req, res) => {
  try {
    const { returnAmount, interestPaid, notes } = req.body;
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: req.user._id });
    
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });
    if (girvi.status === 'returned') {
      return res.status(400).json({ message: 'This girvi has already been returned' });
    }

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

    res.json({ message: 'Partial payment saved successfully', girvi });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Overdue check (cron-ready) ────────────────────────────────────────────────
exports.getOverdueRecords = async (req, res) => {
  try {
    const shopId = req.user._id;
    const today  = new Date();

    const overdue = await GirviRecord.find({
      shop:   shopId,
      status: 'active',
      dueDate: { $lt: today },
    }).populate('customer', 'name phone');

    await GirviRecord.updateMany(
      { shop: shopId, status: 'active', dueDate: { $lt: today } },
      { status: 'overdue' }
    );

    res.json({ count: overdue.length, records: overdue });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
const Customer    = require('../models/Customer');
const GirviRecord = require('../models/GirviRecord');

// Helper — pick filename from req.files


const file = (req, field) =>
  req.files && req.files[field] ? req.files[field][0].filename : undefined;

// ── Add Customer ──────────────────────────────────────────────────────────────
exports.addCustomer = async (req, res) => {
  try {
    const shopId = req.user._id;
    const { name, phone, altPhone, address, city, idType } = req.body;

    const exists = await Customer.findOne({ shop: shopId, phone });
    if (exists)
      return res.status(400).json({ message: 'This phone number is already registered.' });

    const customerData = {
      shop: shopId,
      name, phone, altPhone, address, city, idType,
    };

    // Attach uploaded images
    const fields = ['photo', 'signature', 'aadharFront', 'aadharBack', 'panFront', 'panBack'];
    fields.forEach((f) => { const v = file(req, f); if (v) customerData[f] = v; });

    const customer = await Customer.create(customerData);
    res.status(201).json({ message: 'Customer added successfully!', customer });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Get All Customers ─────────────────────────────────────────────────────────
exports.getCustomers = async (req, res) => {
  try {
    const shopId = req.user._id;
    const { search, page = 1, limit = 20 } = req.query;

    const query = { shop: shopId, isActive: true };
    if (search) {
      query.$or = [
        { name:         { $regex: search, $options: 'i' } },
        { phone:        { $regex: search, $options: 'i' } },
        { customerCode: { $regex: search, $options: 'i' } },
      ];
    }

    const total     = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-aadharFront -aadharBack -panFront -panBack -signature'); // exclude heavy fields from list

    res.json({ customers, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Get Single Customer ───────────────────────────────────────────────────────
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, shop: req.user._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });

    const activeGirvis = await GirviRecord.find({
      customer: customer._id,
      status: { $in: ['active', 'partial', 'overdue'] },
    }).sort({ girviDate: -1 });

    res.json({ customer, activeGirvis });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Update Customer ───────────────────────────────────────────────────────────
exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, shop: req.user._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });

    const fields = ['name', 'phone', 'altPhone', 'address', 'city', 'idType'];
    fields.forEach((f) => { if (req.body[f] !== undefined) customer[f] = req.body[f]; });

    // Update images only if new ones uploaded
    const imgFields = ['photo', 'signature', 'aadharFront', 'aadharBack', 'panFront', 'panBack'];
    imgFields.forEach((f) => { const v = file(req, f); if (v) customer[f] = v; });

    await customer.save();
    res.json({ message: 'Customer updated.', customer });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Soft Delete Customer ──────────────────────────────────────────────────────
exports.deleteCustomer = async (req, res) => {
  try {
    const activeGirvi = await GirviRecord.findOne({
      customer: req.params.id,
      status: { $in: ['active', 'partial', 'overdue'] },
    });
    if (activeGirvi)
      return res.status(400).json({ message: 'Customer has active girvi. Please settle first.' });

    await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.user._id },
      { isActive: false }
    );
    res.json({ message: 'Customer deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Payment History (for payment page) ───────────────────────────────────────
exports.getPaymentHistory = async (req, res) => {
  try {
    const shopId    = req.user._id;
    const customerId = req.params.id;

    const customer = await Customer.findOne({ _id: customerId, shop: shopId });
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });

    // All girvi records for this customer
    const allGirvis = await GirviRecord.find({ customer: customerId, shop: shopId })
      .sort({ girviDate: -1 });

    // Compute summary
    const active   = allGirvis.filter((g) => ['active', 'partial', 'overdue'].includes(g.status));
    const closed   = allGirvis.filter((g) => ['returned', 'forfeited'].includes(g.status));

    const totalPrincipal   = active.reduce((s, g) => s + g.amountGiven, 0);
    const totalInterest    = active.reduce((s, g) => s + (g.interestAccrued || 0), 0);
    const totalOutstanding = totalPrincipal + totalInterest;
    const totalPaid        = allGirvis.reduce((s, g) => s + (g.interestPaid || 0) + (g.returnAmount || 0), 0);

    res.json({
      customer,
      activeGirvis:  active,
      closedGirvis:  closed,
      summary: {
        totalPrincipal:   parseFloat(totalPrincipal.toFixed(2)),
        totalInterest:    parseFloat(totalInterest.toFixed(2)),
        totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
        totalPaid:        parseFloat(totalPaid.toFixed(2)),
        activeCount:      active.length,
        closedCount:      closed.length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
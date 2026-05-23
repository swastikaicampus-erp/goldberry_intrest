const Customer = require('../models/Customer');
const GirviRecord = require('../models/GirviRecord');

// ── Add Customer ──────────────────────────────────────────────────────────────
exports.addCustomer = async (req, res) => {
  try {
    const shopId = req.user._id;
    const { name, phone, altPhone, address, city, idType, idNumber } = req.body;

    // Check duplicate phone in same shop
    const exists = await Customer.findOne({ shop: shopId, phone });
    if (exists)
      return res.status(400).json({ message: 'Is phone number se customer pehle se register hai' });

    const customerData = {
      shop: shopId,
      name, phone, altPhone, address, city, idType, idNumber,
    };

    // Handle uploaded files
    if (req.files) {
      if (req.files['photo'])    customerData.photo   = req.files['photo'][0].filename;
      if (req.files['idPhoto'])  customerData.idPhoto = req.files['idPhoto'][0].filename;
    }

    const customer = await Customer.create(customerData);
    res.status(201).json({ message: 'Customer add ho gaya!', customer });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Get All Customers (with search) ──────────────────────────────────────────
exports.getCustomers = async (req, res) => {
  try {
    const shopId = req.user._id;
    const { search, page = 1, limit = 20 } = req.query;

    const query = { shop: shopId, isActive: true };
    if (search) {
      query.$or = [
        { name:    { $regex: search, $options: 'i' } },
        { phone:   { $regex: search, $options: 'i' } },
        { customerCode: { $regex: search, $options: 'i' } },
      ];
    }

    const total     = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ customers, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Get Single Customer ───────────────────────────────────────────────────────
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      shop: req.user._id,
    });
    if (!customer) return res.status(404).json({ message: 'Customer nahi mila' });

    // Active girvi records bhi laao
    const activeGirvis = await GirviRecord.find({
      customer: customer._id,
      status: 'active',
    }).sort({ girviDate: -1 });

    res.json({ customer, activeGirvis });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Update Customer ───────────────────────────────────────────────────────────
exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.user._id },
      req.body,
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: 'Customer nahi mila' });
    res.json({ message: 'Customer update ho gaya', customer });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Delete (soft delete) Customer ────────────────────────────────────────────
exports.deleteCustomer = async (req, res) => {
  try {
    // Check if customer has active girvi
    const activeGirvi = await GirviRecord.findOne({
      customer: req.params.id,
      status: 'active',
    });
    if (activeGirvi)
      return res.status(400).json({ message: 'Customer ki active girvi hai, pehle settle karo' });

    await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.user._id },
      { isActive: false }
    );
    res.json({ message: 'Customer delete ho gaya' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
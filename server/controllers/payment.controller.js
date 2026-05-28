const GirviRecord = require('../models/GirviRecord');
const Customer = require('../models/Customer');

// ── Make Payment ──────────────────────────────────────────────────────────────
// POST /api/payments/:girviId
exports.makePayment = async (req, res) => {
  try {
    const shopId = req.user._id;
    const { amount, note, method, date } = req.body;

    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ message: 'Invalid payment amount.' });

    const girvi = await GirviRecord.findOne({ _id: req.params.girviId, shop: shopId });
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found.' });

    if (['returned', 'forfeited'].includes(girvi.status))
      return res.status(400).json({ message: 'This loan is already closed.' });

    const paidAmount = Number(amount);
    const paymentDate = date ? new Date(date) : new Date();

    // Total due calculate karna
    const accruedInt = girvi.interestAccrued || 0;
    const alreadyPaid = (girvi.partialPayments || []).reduce((s, p) => s + p.amount, 0);
    const totalDue = parseFloat(
      (girvi.totalAmountGiven + accruedInt - alreadyPaid).toFixed(2)
    );

    // Payment record push karna
    girvi.partialPayments.push({
      date:   paymentDate,
      amount: paidAmount,
      method: method || 'Cash',
      note:   note || '',
    });

    girvi.interestPaid = (girvi.interestPaid || 0) + paidAmount;

    // Auto-close: agar total due clear ho gaya
    if (paidAmount >= totalDue) {
      girvi.status      = 'returned';
      girvi.returnDate  = paymentDate;
      // returnAmount = sabhi payments ka actual total (no double-count)
      girvi.returnAmount = girvi.partialPayments.reduce((s, p) => s + p.amount, 0);
    } else {
      girvi.status = 'partial';
    }

    await girvi.save();

    const updated = await GirviRecord.findById(girvi._id).populate('customer', 'name phone customerCode');
    res.json({
      message: girvi.status === 'returned'
        ? 'Full payment received. Loan closed successfully!'
        : 'Payment recorded successfully.',
      girvi: updated,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Get Payment Summary for Shop Dashboard ────────────────────────────────────
// GET /api/payments/summary
exports.getShopSummary = async (req, res) => {
  try {
    const shopId = req.user._id;
    const girvis = await GirviRecord.find({ shop: shopId });

    const active = girvis.filter(g => ['active', 'partial', 'overdue'].includes(g.status));
    const closed  = girvis.filter(g => g.status === 'returned');

    // ✅ totalAmountGiven (model ka sahi field), amountGiven nahi
    const totalOutstanding = active.reduce(
      (s, g) => s + (g.totalAmountGiven || 0) + (g.interestAccrued || 0), 0
    );

    // ✅ partialPayments ka actual sum — double-count nahi hoga
    const totalCollected = girvis.reduce(
      (s, g) => s + (g.partialPayments || []).reduce((ps, p) => ps + (p.amount || 0), 0), 0
    );

    res.json({
      activeGirvis:     active.length,
      closedGirvis:     closed.length,
      totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
      totalCollected:   parseFloat(totalCollected.toFixed(2)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Get Customer Payment History ──────────────────────────────────────────────
// GET /api/customers/:id/payments  (customer.routes.js mein mount karo)
exports.getCustomerPayments = async (req, res) => {
  try {
    const shopId     = req.user._id;
    const customerId = req.params.id;

    const customer = await Customer.findOne({ _id: customerId, shop: shopId });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const allGirvis = await GirviRecord.find({ shop: shopId, customer: customerId });

    const active = allGirvis.filter(g => ['active', 'partial', 'overdue'].includes(g.status));
    const closed  = allGirvis.filter(g => ['returned', 'forfeited'].includes(g.status));

    const totalPrincipal = active.reduce((s, g) => s + (g.totalAmountGiven || 0), 0);
    const totalInterest  = active.reduce((s, g) => s + (g.interestAccrued  || 0), 0);

    const totalPaid = allGirvis.reduce(
      (s, g) => s + (g.partialPayments || []).reduce((ps, p) => ps + (p.amount || 0), 0), 0
    );

    const totalOutstanding = active.reduce((s, g) => {
      const paid = (g.partialPayments || []).reduce((ps, p) => ps + (p.amount || 0), 0);
      return s + Math.max(0, (g.totalAmountGiven || 0) + (g.interestAccrued || 0) - paid);
    }, 0);

    res.json({
      customer,
      activeGirvis: active,
      closedGirvis: closed,
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
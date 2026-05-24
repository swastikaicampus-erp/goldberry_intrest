const GirviRecord = require('../models/GirviRecord');
const Customer    = require('../models/Customer');

// ── Make Payment ──────────────────────────────────────────────────────────────
// POST /api/payments/:girviId
exports.makePayment = async (req, res) => {
  try {
    const shopId  = req.user._id;
    const { amount, note, paymentType } = req.body;
    // paymentType: 'partial' | 'full'

    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ message: 'Invalid payment amount.' });

    const girvi = await GirviRecord.findOne({ _id: req.params.girviId, shop: shopId });
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found.' });

    if (['returned', 'forfeited'].includes(girvi.status))
      return res.status(400).json({ message: 'This girvi is already closed.' });

    const paidAmount = Number(amount);
    const totalDue   = girvi.amountGiven + (girvi.interestAccrued || 0);

    if (paymentType === 'full') {
      // Full payment — close girvi
      girvi.returnAmount  = paidAmount;
      girvi.interestPaid  = paidAmount - girvi.amountGiven > 0
                            ? paidAmount - girvi.amountGiven
                            : 0;
      girvi.returnDate    = new Date();
      girvi.status        = 'returned';
      girvi.partialPayments.push({
        date:   new Date(),
        amount: paidAmount,
        note:   note || 'Full payment — girvi closed',
      });
    } else {
      // Partial payment
      girvi.interestPaid = (girvi.interestPaid || 0) + paidAmount;
      girvi.partialPayments.push({
        date:   new Date(),
        amount: paidAmount,
        note:   note || 'Partial payment',
      });
      // If total paid >= total due, auto-close
      const totalPaidSoFar = girvi.partialPayments.reduce((s, p) => s + p.amount, 0);
      if (totalPaidSoFar >= totalDue) {
        girvi.status      = 'returned';
        girvi.returnDate  = new Date();
        girvi.returnAmount = totalPaidSoFar;
      } else {
        girvi.status = 'partial';
      }
    }

    await girvi.save();

    // Re-fetch with virtuals
    const updated = await GirviRecord.findById(girvi._id);
    res.json({
      message: paymentType === 'full'
        ? 'Full payment received. Girvi closed successfully!'
        : 'Partial payment recorded.',
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
    const shopId  = req.user._id;
    const girvis  = await GirviRecord.find({ shop: shopId });

    const active  = girvis.filter((g) => ['active', 'partial', 'overdue'].includes(g.status));
    const closed  = girvis.filter((g) => g.status === 'returned');

    const totalOutstanding = active.reduce(
      (s, g) => s + g.amountGiven + (g.interestAccrued || 0), 0
    );
    const totalCollected = girvis.reduce(
      (s, g) => s + (g.returnAmount || 0) + (g.interestPaid || 0), 0
    );

    res.json({
      activeGirvis:    active.length,
      closedGirvis:    closed.length,
      totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
      totalCollected:   parseFloat(totalCollected.toFixed(2)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/customers/:id/payments ──────────────────────────────────────────
// Add this function to your Customer controller
exports.getCustomerPayments = async (req, res) => {
  try {
    const shopId     = req.user._id;
    const customerId = req.params.id;

    // Verify customer belongs to this shop
    const customer = await Customer.findOne({ _id: customerId, shop: shopId });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // Fetch all girvi records for this customer
    const allGirvis = await GirviRecord.find({ shop: shopId, customer: customerId });

    const active = allGirvis.filter(g => ['active', 'partial', 'overdue'].includes(g.status));
    const closed = allGirvis.filter(g => ['returned', 'forfeited'].includes(g.status));

    // ── Summary calculations ──
    const totalPrincipal = active.reduce((s, g) => s + (g.totalAmountGiven || 0), 0);
    const totalInterest  = active.reduce((s, g) => s + (g.interestAccrued  || 0), 0);
    const totalPaid      = allGirvis.reduce((s, g) => {
      return s + (g.partialPayments || []).reduce((ps, p) => ps + (p.amount || 0), 0);
    }, 0);
    const totalOutstanding = active.reduce((s, g) => {
      const paid = (g.partialPayments || []).reduce((ps, p) => ps + (p.amount || 0), 0);
      return s + Math.max(0, (g.totalAmountGiven || 0) + (g.interestAccrued || 0) - paid);
    }, 0);

    res.json({
      customer,
      activeGirvis: active,
      closedGirvis: closed,
      summary: {
        totalPrincipal:   parseFloat((totalPrincipal   || 0).toFixed(2)),
        totalInterest:    parseFloat((totalInterest    || 0).toFixed(2)),
        totalOutstanding: parseFloat((totalOutstanding || 0).toFixed(2)),
        totalPaid:        parseFloat((totalPaid        || 0).toFixed(2)),
        activeCount:      active.length,
        closedCount:      closed.length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Route (customer.routes.js mein add karo) ─────────────────────────────────
// router.get('/:id/payments', getCustomerPayments);
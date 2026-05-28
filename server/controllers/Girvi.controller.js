const GirviRecord = require('../models/GirviRecord');
const Customer = require('../models/Customer');
const path = require('path');
const fs = require('fs');

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
      shop: shopId,
      customer: customerId,
      items,
      interestRate: Number(interestRate),
      girviDate: girviDate ? new Date(girviDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
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
    if (status) query.status = status;
    if (customerId) query.customer = customerId;
    if (search) {
      query.$or = [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { 'items.itemType': { $regex: search, $options: 'i' } },
        { 'items.itemDescription': { $regex: search, $options: 'i' } },
      ];
    }

    const total = await GirviRecord.countDocuments(query);
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
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: shopId });
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
    if (girviDate !== undefined) girvi.girviDate = new Date(girviDate);
    if (dueDate !== undefined) girvi.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) girvi.notes = notes;
    if (status !== undefined) girvi.status = status;

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
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: shopId });
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

    const days = girvi.daysElapsed;
    const interest = girvi.interestAccrued;
    const total = parseFloat((girvi.totalAmountGiven + interest).toFixed(2));

    res.json({
      ticketNumber: girvi.ticketNumber,
      principal: girvi.totalAmountGiven,
      interestRate: girvi.interestRate,
      interestType: 'per_day',
      daysElapsed: days,
      interestAccrued: interest,
      totalDue: total,
      items: girvi.items,
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
    if (['returned', 'forfeited'].includes(girvi.status))
      return res.status(400).json({ message: `Already ${girvi.status}` });
    girvi.status = 'returned';
    girvi.returnDate = new Date();
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
    const { amount, note, method } = req.body;
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: req.user._id });
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });

    girvi.partialPayments.push({
      date: new Date(),
      amount: Number(amount),
      note,
      method: method || 'Cash'
    }); girvi.interestPaid += Number(amount);
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
    const today = new Date();

    // Pehle update karo
    await GirviRecord.updateMany(
      { shop: shopId, status: 'active', dueDate: { $lt: today } },
      { status: 'overdue' }
    );

    // Phir fetch karo — updated data milega
    const overdue = await GirviRecord.find({ shop: shopId, status: 'overdue' })
      .populate('customer', 'name phone');

    res.json({ count: overdue.length, records: overdue }); // ← sirf ek baar
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getClosedRecords = async (req, res) => {
  try {
    const shopId = req.user._id;
    const records = await GirviRecord.find({
      shop: shopId,
      status: { $in: ['returned', 'forfeited'] }  // ← 'closed' hatao
    }).populate('customer');

    res.status(200).json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Interest Report ───────────────────────────────────────────────────────────
exports.generateInterestReport = async (req, res) => {
  try {
    const girvi = await GirviRecord.findOne({ _id: req.params.id, shop: req.user._id })
      .populate('customer', 'name phone customerCode address');
    if (!girvi) return res.status(404).json({ message: 'Girvi record not found' });

    const principal = girvi.totalAmountGiven;
    const rate = girvi.interestRate; // % per day
    const dailyInterest = parseFloat(((principal * rate) / 100).toFixed(2));

    // ── Date Range ────────────────────────────────────────────────────────────
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(girvi.girviDate);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : girvi.returnDate || new Date();

    // Normalize to midnight
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // ── Build Transaction Ledger ──────────────────────────────────────────────
    const transactions = [];

    // 1. Customer payments (cr) in date range
    (girvi.partialPayments || []).forEach((pay) => {
      const payDate = new Date(pay.date);
      if (payDate >= startDate && payDate <= endDate) {
        transactions.push({
          date: payDate,
          amount: pay.amount,
          txnType: 'cr',
          note: pay.method || pay.note || 'Payment',
        });
      }
    });

    // 2. Daily interest debit (dr) for each day in range
    const loopStart = new Date(startDate);
    const loopEnd = new Date(endDate);
    loopEnd.setHours(0, 0, 0, 0); // compare date only

    for (
      let d = new Date(loopStart);
      d <= loopEnd;
      d.setDate(d.getDate() + 1)
    ) {
      transactions.push({
        date: new Date(d),
        amount: dailyInterest,
        txnType: 'dr',
        note: 'Daily Interest',
      });
    }

    // 3. Sort by date ascending
    transactions.sort((a, b) => a.date - b.date);

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalDays = Math.max(
      1,
      Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
    );
    const totalInterest = parseFloat((dailyInterest * totalDays).toFixed(2));
    const totalPaid = transactions
      .filter((t) => t.txnType === 'cr')
      .reduce((sum, t) => sum + t.amount, 0);

    const report = {
      ticketNumber: girvi.ticketNumber,
      customer: girvi.customer,
      items: girvi.items,
      principal,
      interestRate: rate,
      dailyInterest,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalDays,
      totalInterest,
      totalPaid: parseFloat(totalPaid.toFixed(2)),
      totalDue: parseFloat((principal + totalInterest - totalPaid).toFixed(2)),
      transactions: transactions.map((t, i) => ({
        sNo: i + 1,
        date: t.date.toISOString().split('T')[0],
        amount: t.amount,
        txnType: t.txnType,
        note: t.note,
      })),
    };

    // ── PDF ───────────────────────────────────────────────────────────────────
    if (req.query.format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 40, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=girvi-txn-${girvi.ticketNumber}.pdf`
      );
      doc.pipe(res);

      // Header
      doc.fontSize(18).font('Helvetica-Bold')
        .text('Girvi Transaction Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica')
        .text(`Ticket: ${girvi.ticketNumber}`, { align: 'center' })
        .text(`Period: ${report.startDate} to ${report.endDate}`, { align: 'center' })
        .text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });

      doc.moveDown();
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Customer
      doc.fontSize(11).font('Helvetica-Bold').text('Customer Details');
      doc.fontSize(10).font('Helvetica')
        .text(`Name: ${girvi.customer.name}`)
        .text(`Phone: ${girvi.customer.phone}`);
      doc.moveDown();

      // Summary
      doc.fontSize(11).font('Helvetica-Bold').text('Summary');
      doc.fontSize(10).font('Helvetica')
        .text(`Principal: ₹${principal}`)
        .text(`Rate: ${rate}% per day  |  Daily Interest: ₹${dailyInterest}`)
        .text(`Total Days: ${totalDays}  |  Total Interest: ₹${totalInterest}`)
        .text(`Total Paid: ₹${report.totalPaid}  |  Total Due: ₹${report.totalDue}`);
      doc.moveDown();

      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Table Header
      doc.fontSize(11).font('Helvetica-Bold').text('Transactions');
      doc.moveDown(0.3);

      const col = { sno: 40, date: 80, amount: 200, type: 320, note: 390 };
      const tableTop = doc.y;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('S.No', col.sno, tableTop)
        .text('Date', col.date, tableTop)
        .text('Amount (₹)', col.amount, tableTop)
        .text('Txn Type', col.type, tableTop)
        .text('Note', col.note, tableTop);

      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.2);

      report.transactions.forEach((row, i) => {
        const y = doc.y;
        const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
        doc.rect(40, y - 2, 515, 14).fill(bg).stroke('#eeeeee');
        doc.fillColor('black').fontSize(9).font('Helvetica')
          .text(String(row.sNo), col.sno, y)
          .text(row.date, col.date, y)
          .text(`₹${row.amount}`, col.amount, y)
          .text(row.txnType, col.type, y)
          .text(row.note, col.note, y, { width: 160 });
        doc.moveDown(0.6);
      });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(12).font('Helvetica-Bold')
        .text(`Total Due: ₹${report.totalDue}`, { align: 'right' });

      doc.end();
      return;
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemType: { type: String, enum: ['Gold', 'Silver', 'Diamond', 'Other'], required: true },
  itemDescription: { type: String, default: '' },
  weightGrams: { type: Number, required: true },
  purity: { type: String, default: '' },        // e.g. "22K", "925", "999"
  carats: { type: Number, default: null },       // e.g. 2.5 (mainly Diamond ke liye)
  estimatedValue: { type: Number, required: true },
  amountGiven: { type: Number, required: true },
  photos: [{ type: String }],
}, { _id: true });

const girviRecordSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },

  // Ticket number: GRV-2024-0001
  ticketNumber: { type: String, unique: true },

  // ── Multiple items ──────────────────────────────────────────────────────
  items: { type: [itemSchema], required: true, validate: v => v.length > 0 },

  // ── Totals (auto-computed on save) ─────────────────────────────────────
  totalEstimatedValue: { type: Number, default: 0 },
  totalAmountGiven: { type: Number, default: 0 },  // principal

  // ── Loan ───────────────────────────────────────────────────────────────
  interestRate: { type: Number, required: true },   // % per day
  // interestType removed — always per_day

  // ── Dates ──────────────────────────────────────────────────────────────
  girviDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date },

  // ── Status ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['active', 'returned', 'partial', 'overdue', 'forfeited'],
    default: 'active',
  },

  // ── Settlement ─────────────────────────────────────────────────────────
  returnDate: { type: Date },
  returnAmount: { type: Number },
  interestPaid: { type: Number, default: 0 },
  partialPayments: [{
    date: { type: Date },
    amount: { type: Number },
    method: { type: String, enum: ['Cash', 'Check', 'Online Bank Transfer'], default: 'Cash' }, // ✅ NAYA FIELD
    note: { type: String },
  }],

  agreementPath: { type: String, default: '' },
  notes: { type: String, default: '' },

}, { timestamps: true });

// ── Auto-compute totals before save ──────────────────────────────────────────
girviRecordSchema.pre('save', async function (next) {
  // Totals
  this.totalEstimatedValue = this.items.reduce((s, i) => s + i.estimatedValue, 0);
  this.totalAmountGiven = this.items.reduce((s, i) => s + i.amountGiven, 0);

  // Ticket number (new records only)
  if (this.isNew) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('GirviRecord').countDocuments({ shop: this.shop });
    this.ticketNumber = `GRV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// ── Virtual: days elapsed ─────────────────────────────────────────────────────
girviRecordSchema.virtual('daysElapsed').get(function () {
  const from = this.girviDate || this.createdAt;
  const to = this.returnDate || new Date();
  return Math.max(1, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
});

// ── Virtual: interest accrued (per-day only) ──────────────────────────────────
girviRecordSchema.virtual('interestAccrued').get(function () {
  const days = this.daysElapsed;
  return parseFloat(((this.totalAmountGiven * this.interestRate * days) / 100).toFixed(2));
});

girviRecordSchema.set('toJSON', { virtuals: true });
girviRecordSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('GirviRecord', girviRecordSchema);
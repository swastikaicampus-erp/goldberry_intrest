const mongoose = require('mongoose');

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

  // Ticket number auto-generated: GRV-2024-0001
  ticketNumber: { type: String, unique: true },

  // Item details
  itemType:   {
    type: String,
    enum: ['Gold', 'Silver', 'Diamond', 'Other'],
    required: true,
  },
  itemDescription: { type: String, default: '' }, // e.g. "Gold Necklace"
  weightGrams: { type: Number, required: true },
  purity:     { type: String, required: true },   // 24K, 22K, 18K, 925 etc.
  estimatedValue: { type: Number, required: true },

  // Loan details
  amountGiven: { type: Number, required: true },
  interestRate: { type: Number, required: true },  // e.g. 2 (%)
  interestType: {
    type: String,
    enum: ['per_day', 'per_month'],
    default: 'per_month',
  },

  // Dates
  girviDate:  { type: Date, required: true, default: Date.now },
  dueDate:    { type: Date },   // optional, for deadline

  // Status
  status: {
    type: String,
    enum: ['active', 'returned', 'partial', 'overdue', 'forfeited'],
    default: 'active',
  },

  // Settlement
  returnDate:     { type: Date },
  returnAmount:   { type: Number },   // principal + interest paid
  interestPaid:   { type: Number, default: 0 },
  partialPayments: [
    {
      date:    { type: Date },
      amount:  { type: Number },
      note:    { type: String },
    }
  ],

  // Item photos (up to 4)
  photos: [{ type: String }],

  // Agreement PDF path
  agreementPath: { type: String, default: '' },

  notes: { type: String, default: '' },
}, { timestamps: true });

// Auto-generate ticketNumber
girviRecordSchema.pre('save', async function (next) {
  if (this.isNew) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('GirviRecord').countDocuments({ shop: this.shop });
    this.ticketNumber = `GRV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Virtual: days elapsed
girviRecordSchema.virtual('daysElapsed').get(function () {
  const from = this.girviDate || this.createdAt;
  const to   = this.returnDate || new Date();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
});

// Virtual: interest accrued (simple interest)
girviRecordSchema.virtual('interestAccrued').get(function () {
  const days = this.daysElapsed;
  if (this.interestType === 'per_day') {
    return parseFloat(((this.amountGiven * this.interestRate * days) / 100).toFixed(2));
  } else {
    // per_month → divide by 30
    const months = days / 30;
    return parseFloat(((this.amountGiven * this.interestRate * months) / 100).toFixed(2));
  }
});

girviRecordSchema.set('toJSON', { virtuals: true });
girviRecordSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('GirviRecord', girviRecordSchema);
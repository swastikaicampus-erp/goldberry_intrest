const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: { type: String, enum: ['Basic', 'Standard', 'Premium'], required: true },
  price: { type: Number, required: true },
  durationMonths: { type: Number, required: true },
  maxCustomers: { type: Number },
  features: [String],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
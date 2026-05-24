const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },

  // Basic Info
  name:     { type: String, required: true, trim: true },
  phone:    { type: String, required: true },
  altPhone: { type: String, default: '' },
  address:  { type: String, required: true },
  city:     { type: String, default: '' },

  // ID Proof Type only (no idNumber)
  idType: {
    type: String,
    enum: ['Aadhar', 'PAN', 'Voter ID', 'Driving License', 'Passport'],
    default: 'Aadhar',
  },

  // Images — all stored as filenames (multer local)
  photo:         { type: String, default: '' }, // Customer profile photo
  signature:     { type: String, default: '' }, // Customer signature
  aadharFront:   { type: String, default: '' }, // Aadhar front
  aadharBack:    { type: String, default: '' }, // Aadhar back
  panFront:      { type: String, default: '' }, // PAN front
  panBack:       { type: String, default: '' }, // PAN back

  isActive:     { type: Boolean, default: true },
  customerCode: { type: String, unique: true }, // CUST-0001

}, { timestamps: true });

// Auto-generate customerCode
customerSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Customer').countDocuments({ shop: this.shop });
    this.customerCode = `CUST-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Customer', customerSchema);
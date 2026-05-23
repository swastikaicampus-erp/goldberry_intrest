const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },
  name:       { type: String, required: true, trim: true },
  phone:      { type: String, required: true },
  altPhone:   { type: String, default: '' },
  address:    { type: String, required: true },
  city:       { type: String, default: '' },
  idType:     {
    type: String,
    enum: ['Aadhar', 'PAN', 'Voter ID', 'Driving License', 'Passport'],
    default: 'Aadhar',
  },
  idNumber:   { type: String, default: '' },
  idPhoto:    { type: String, default: '' },   // file path / base64
  photo:      { type: String, default: '' },   // customer photo
  isActive:   { type: Boolean, default: true },
  customerCode: { type: String, unique: true }, // auto: CUST-0001
}, { timestamps: true });

// Auto-generate customerCode before save
customerSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Customer').countDocuments({ shop: this.shop });
    this.customerCode = `CUST-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Customer', customerSchema);
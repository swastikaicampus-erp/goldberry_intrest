const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const shopSchema = new mongoose.Schema({
  shopName: { type: String, required: true },
  ownerName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  gstNumber: { type: String },
  loginId: { type: String, unique: true },
  password: { type: String },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  planPurchasedAt: { type: Date },
  planExpiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  role: { type: String, default: 'shop' }
}, { timestamps: true });

shopSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

shopSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Shop', shopSchema);
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Shop  = require('../models/Shop');

const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.role === 'master_admin') {
        req.user = await Admin.findById(decoded.id).select('-password');
      } else {
        req.user = await Shop.findById(decoded.id).select('-password');
      }
      req.role     = decoded.role;
      req.shopId   = decoded.role === 'shop' ? decoded.id : null;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token invalid ya expired hai' });
    }
  } else {
    return res.status(401).json({ message: 'Token nahi mila, login karo' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.role !== 'master_admin') {
    return res.status(403).json({ message: 'Sirf Master Admin access kar sakta hai' });
  }
  next();
};

const shopOnly = (req, res, next) => {
  if (req.role !== 'shop') {
    return res.status(403).json({ message: 'Sirf Shop Owner access kar sakta hai' });
  }
  next();
};

module.exports = { protect, adminOnly, shopOnly };
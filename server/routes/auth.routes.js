const express = require('express');
const router = express.Router();
const { adminLogin, shopLogin } = require('../controllers/auth.controller');

router.post('/admin/login', adminLogin);
router.post('/shop/login', shopLogin);

module.exports = router;
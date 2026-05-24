const router = require('express').Router();
const { protect, shopOnly } = require('../middleware/auth.middleware');
const { makePayment, getShopSummary, getCustomerPayments } = require('../controllers/payment.controller');

router.use(protect, shopOnly);

router.post('/:girviId', makePayment);    // POST /api/payments/:girviId
router.get('/summary', getShopSummary); // GET  /api/payments/summary
router.get('/:id/payments', getCustomerPayments);

module.exports = router;

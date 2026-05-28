const router = require('express').Router();
const { protect, shopOnly } = require('../middleware/auth.middleware');
const { makePayment, getShopSummary } = require('../controllers/payment.controller');

router.use(protect, shopOnly);
router.get('/summary', getShopSummary);  
router.post('/:girviId', makePayment);    

module.exports = router;


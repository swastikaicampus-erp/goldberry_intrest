const router = require('express').Router();
const { protect, shopOnly } = require('../middleware/auth.middleware');
const { customerUpload } = require('../middleware/Upload.middleware');
const {
  addCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getPaymentHistory,
} = require('../controllers/Customer.controller');

router.use(protect, shopOnly);

router.post('/', customerUpload, addCustomer);
router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.put('/:id', customerUpload, updateCustomer);
router.delete('/:id', deleteCustomer);
router.get('/:id/payments', getPaymentHistory); // payment history

module.exports = router;
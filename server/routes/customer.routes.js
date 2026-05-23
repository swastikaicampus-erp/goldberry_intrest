const router   = require('express').Router();
const { protect, shopOnly } = require('../middleware/auth.middleware');
const upload   = require('../middleware/Upload.middleware');
const {
  addCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/Customer.controller');





router.use(protect, shopOnly);




// Customer CRUD new
router.post('/',
  upload.fields([
    { name: 'photo',   maxCount: 1 },
    { name: 'idPhoto', maxCount: 1 },
  ]),
  addCustomer
);
router.get('/',       getCustomers);
router.get('/:id',    getCustomer);
router.put('/:id',    updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
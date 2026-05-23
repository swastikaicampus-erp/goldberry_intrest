const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/shops', require('./routes/shop.routes'));
app.use('/api/plans', require('./routes/plan.routes'));
app.use('/api/customers', require('./routes/customer.routes'));
app.use('/api/girvi', require('./routes/girvi.routes'));

app.get('/', (req, res) => res.json({ message: 'Gold Girvi API Running' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
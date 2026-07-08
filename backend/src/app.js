const express = require('express');
const cors = require('cors');
require('dotenv').config();

const itemRoutes = require('./routes/items');
const auctionRoutes = require('./routes/auctions');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/items', itemRoutes);
app.use('/api/auctions', auctionRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;

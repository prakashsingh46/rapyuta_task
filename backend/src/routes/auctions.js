const express = require('express');
const router = express.Router();
const { Auctions, Items } = require('../store/db');

// GET all auctions
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const auctions = Auctions.findAll(filter);
    res.json({ success: true, data: auctions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET auction by ID
router.get('/:id', (req, res) => {
  try {
    const auction = Auctions.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ success: false, error: 'Auction not found' });
    }
    res.json({ success: true, data: auction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create auction
router.post('/', (req, res) => {
  try {
    const { itemId, timerDuration } = req.body;
    const item = Items.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const auction = Auctions.create({
      item: item._id,
      itemSnapshot: {
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        basePrice: item.basePrice,
        minIncrement: item.minIncrement
      },
      timerDuration: timerDuration || 60,
      timerExtension: 10,
      status: 'pending'
    });

    res.status(201).json({ success: true, data: auction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST start auction
router.post('/:id/start', (req, res) => {
  try {
    const result = Auctions.startAuction(req.params.id);
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST participate in auction
router.post('/:id/participate', (req, res) => {
  try {
    const { oderId, odeerName } = req.body;
    if (!oderId || !odeerName) {
      return res.status(400).json({ success: false, error: 'oderId and odeerName are required' });
    }

    const result = Auctions.addParticipant(req.params.id, oderId, odeerName);
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST place bid
router.post('/:id/bid', (req, res) => {
  try {
    const { oderId, odeerName, amount } = req.body;
    if (!oderId || !odeerName || !amount) {
      return res.status(400).json({ success: false, error: 'oderId, odeerName, and amount are required' });
    }

    const result = Auctions.placeBid(req.params.id, oderId, odeerName, parseFloat(amount));
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error, details: result });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

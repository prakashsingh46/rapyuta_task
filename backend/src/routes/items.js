const express = require('express');
const router = express.Router();
const { Items } = require('../store/db');

// GET all items
router.get('/', (req, res) => {
  try {
    const items = Items.findAll();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET item by ID
router.get('/:id', (req, res) => {
  try {
    const item = Items.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

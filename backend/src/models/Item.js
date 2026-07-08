const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String, default: '' },
  category: { type: String, default: 'General' },
  basePrice: { type: Number, required: true },
  minIncrement: { type: Number, required: true, default: 10 },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Item', itemSchema);

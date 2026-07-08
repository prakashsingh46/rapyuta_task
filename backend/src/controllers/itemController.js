const Item = require('../models/Item');

// Create new item
const createItem = async (req, res) => {
  try {
    const { name, description, imageUrl, category, basePrice, minIncrement } = req.body;

    // Validate required fields
    if (!name || !basePrice) {
      return res.status(400).json({
        success: false,
        message: 'Name and base price are required'
      });
    }

    const item = new Item({
      name,
      description,
      imageUrl,
      category,
      basePrice,
      minIncrement: minIncrement || 1,
      createdBy: req.user.id
    });

    await item.save();

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: item
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating item',
      error: error.message
    });
  }
};

// Get all available items
const getAllItems = async (req, res) => {
  try {
    const items = await Item.find({ isAvailable: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching items',
      error: error.message
    });
  }
};

// Get single item by ID
const getItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findById(id)
      .populate('createdBy', 'name email');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching item:', error);

    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching item',
      error: error.message
    });
  }
};

// Update item (only by creator)
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, category, basePrice, minIncrement } = req.body;

    // Find the item first
    let item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Check if user is the creator
    if (item.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this item'
      });
    }

    // Build update object
    const updateFields = {};
    if (name) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (imageUrl !== undefined) updateFields.imageUrl = imageUrl;
    if (category) updateFields.category = category;
    if (basePrice) updateFields.basePrice = basePrice;
    if (minIncrement) updateFields.minIncrement = minIncrement;

    // Update the item
    item = await Item.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating item:', error);

    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating item',
      error: error.message
    });
  }
};

// Soft delete item (set isAvailable to false)
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the item first
    let item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Check if user is the creator
    if (item.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this item'
      });
    }

    // Soft delete by setting isAvailable to false
    item = await Item.findByIdAndUpdate(
      id,
      { $set: { isAvailable: false } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
      data: item
    });
  } catch (error) {
    console.error('Error deleting item:', error);

    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while deleting item',
      error: error.message
    });
  }
};

module.exports = {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem
};

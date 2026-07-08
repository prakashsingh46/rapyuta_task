const Auction = require('../models/Auction');
const Item = require('../models/Item');

/**
 * Create a new auction from an item
 * POST /api/auctions
 */
const createAuction = async (req, res) => {
  try {
    const { itemId, startingPrice, reservePrice, timerDuration } = req.body;

    // Validate required fields
    if (!itemId || !startingPrice) {
      return res.status(400).json({
        success: false,
        message: 'itemId and startingPrice are required'
      });
    }

    // Find the item
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Check if item belongs to the user
    if (item.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only create auctions for your own items'
      });
    }

    // Check if item already has an active auction
    const existingAuction = await Auction.findOne({
      item: itemId,
      status: { $in: ['pending', 'active'] }
    });

    if (existingAuction) {
      return res.status(400).json({
        success: false,
        message: 'This item already has an active or pending auction'
      });
    }

    // Create item snapshot
    const itemSnapshot = {
      title: item.title,
      description: item.description,
      images: item.images || [],
      category: item.category
    };

    // Create the auction
    const auction = new Auction({
      item: itemId,
      seller: req.user._id,
      itemSnapshot,
      startingPrice,
      currentPrice: startingPrice,
      reservePrice: reservePrice || 0,
      timerDuration: timerDuration || 300, // Default 5 minutes
      status: 'pending'
    });

    await auction.save();

    // Update item status
    item.status = 'in_auction';
    await item.save();

    res.status(201).json({
      success: true,
      message: 'Auction created successfully',
      data: auction
    });
  } catch (error) {
    console.error('Create auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating auction',
      error: error.message
    });
  }
};

/**
 * Get all auctions with optional status filter
 * GET /api/auctions
 */
const getAllAuctions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get auctions with pagination
    const auctions = await Auction.find(query)
      .populate('item', 'title images')
      .populate('seller', 'username email')
      .populate('highestBidder', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Auction.countDocuments(query);

    res.status(200).json({
      success: true,
      data: auctions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Get all auctions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auctions',
      error: error.message
    });
  }
};

/**
 * Get a single auction by ID
 * GET /api/auctions/:id
 */
const getAuctionById = async (req, res) => {
  try {
    const { id } = req.params;

    const auction = await Auction.findById(id)
      .populate('item')
      .populate('seller', 'username email')
      .populate('highestBidder', 'username email')
      .populate('bids.bidder', 'username');

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: auction
    });
  } catch (error) {
    console.error('Get auction by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching auction',
      error: error.message
    });
  }
};

/**
 * Start a pending auction
 * POST /api/auctions/:id/start
 */
const startAuction = async (req, res) => {
  try {
    const { id } = req.params;

    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Check if user is the seller
    if (auction.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller can start the auction'
      });
    }

    // Check if auction is pending
    if (auction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot start auction with status: ${auction.status}`
      });
    }

    // Set auction as active
    auction.status = 'active';
    auction.startedAt = new Date();
    auction.endsAt = new Date(Date.now() + auction.timerDuration * 1000);

    await auction.save();

    // Populate for response
    await auction.populate('item');
    await auction.populate('seller', 'username email');

    res.status(200).json({
      success: true,
      message: 'Auction started successfully',
      data: auction
    });
  } catch (error) {
    console.error('Start auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting auction',
      error: error.message
    });
  }
};

/**
 * Place a bid on an auction
 * POST /api/auctions/:id/bid
 * This function returns data suitable for Socket.io broadcasting
 */
const placeBid = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const bidderId = req.user._id;

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid bid amount is required'
      });
    }

    // Use the static placeBid method from Auction model
    // This handles CAS pattern and timer extension
    const result = await Auction.placeBid(id, bidderId, amount);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        code: result.code
      });
    }

    // Populate bidder info for the response
    await result.auction.populate('highestBidder', 'username email');

    // Return response suitable for Socket.io broadcasting
    res.status(200).json({
      success: true,
      message: 'Bid placed successfully',
      data: {
        auction: result.auction,
        bid: result.bid,
        newPrice: result.auction.currentPrice,
        endsAt: result.auction.endsAt,
        highestBidder: result.auction.highestBidder,
        bidCount: result.auction.bids.length
      }
    });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Error placing bid',
      error: error.message
    });
  }
};

/**
 * Close an auction manually
 * POST /api/auctions/:id/close
 */
const closeAuction = async (req, res) => {
  try {
    const { id } = req.params;

    const auction = await Auction.findById(id);

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Check if user is the seller
    if (auction.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller can close the auction'
      });
    }

    // Check if auction can be closed
    if (auction.status === 'completed' || auction.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Auction is already ${auction.status}`
      });
    }

    // Determine winner if there are bids
    let winner = null;
    let finalPrice = null;

    if (auction.bids && auction.bids.length > 0) {
      // Check if reserve price is met
      if (auction.currentPrice >= auction.reservePrice) {
        winner = auction.highestBidder;
        finalPrice = auction.currentPrice;
      }
    }

    // Update auction
    auction.status = 'completed';
    auction.closedAt = new Date();

    if (winner) {
      auction.winner = winner;
      auction.finalPrice = finalPrice;
    }

    await auction.save();

    // Update item status
    const item = await Item.findById(auction.item);
    if (item) {
      item.status = winner ? 'sold' : 'available';
      await item.save();
    }

    // Populate for response
    await auction.populate('winner', 'username email');
    await auction.populate('seller', 'username email');

    res.status(200).json({
      success: true,
      message: winner
        ? 'Auction closed successfully with a winner'
        : 'Auction closed with no winner (reserve not met or no bids)',
      data: {
        auction,
        winner: auction.winner,
        finalPrice: auction.finalPrice,
        totalBids: auction.bids ? auction.bids.length : 0
      }
    });
  } catch (error) {
    console.error('Close auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error closing auction',
      error: error.message
    });
  }
};

module.exports = {
  createAuction,
  getAllAuctions,
  getAuctionById,
  startAuction,
  placeBid,
  closeAuction
};

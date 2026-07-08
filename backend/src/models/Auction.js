const mongoose = require('mongoose');

// Sub-schema for bid history
const bidSchema = new mongoose.Schema({
  oderId: String,
  odeerName: String,
  amount: Number,
  timestamp: { type: Date, default: Date.now }
});

const auctionSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  itemSnapshot: {
    name: String,
    description: String,
    imageUrl: String,
    basePrice: Number,
    minIncrement: Number
  },
  currentHighestBid: { type: Number, default: 0 },
  highestBidderId: { type: String, default: null },
  highestBidderName: { type: String, default: null },
  timerDuration: { type: Number, default: 15 },
  timerExtension: { type: Number, default: 10 },
  endsAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending', 'active', 'closed'],
    default: 'pending'
  },
  winnerId: { type: String, default: null },
  winnerName: { type: String, default: null },
  winningBid: { type: Number, default: null },
  bids: [bidSchema],
  bidCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null }
});

// Get minimum valid bid
auctionSchema.methods.getMinimumBid = function() {
  if (this.currentHighestBid === 0) {
    return this.itemSnapshot.basePrice;
  }
  return this.currentHighestBid + this.itemSnapshot.minIncrement;
};

// Atomic bid placement
auctionSchema.statics.placeBid = async function(auctionId, oderId, odeerName, bidAmount) {
  const now = new Date();
  const auction = await this.findById(auctionId);

  if (!auction) return { error: 'AUCTION_NOT_FOUND' };
  if (auction.status !== 'active') return { error: 'AUCTION_NOT_ACTIVE' };
  if (auction.endsAt <= now) return { error: 'AUCTION_ENDED' };

  const minBid = auction.getMinimumBid();
  if (bidAmount < minBid) {
    return {
      error: 'BID_TOO_LOW',
      minBid,
      currentHighestBid: auction.currentHighestBid
    };
  }

  // Extend timer if bid is in final seconds
  const remainingTime = (auction.endsAt - now) / 1000;
  let newEndsAt = auction.endsAt;
  if (remainingTime < auction.timerExtension) {
    newEndsAt = new Date(now.getTime() + auction.timerExtension * 1000);
  }

  // Atomic CAS update
  const result = await this.findOneAndUpdate(
    {
      _id: auctionId,
      status: 'active',
      endsAt: { $gt: now },
      currentHighestBid: { $lt: bidAmount }
    },
    {
      $set: {
        currentHighestBid: bidAmount,
        highestBidderId: oderId,
        highestBidderName: odeerName,
        endsAt: newEndsAt
      },
      $inc: { bidCount: 1 },
      $push: {
        bids: {
          oderId,
          odeerName,
          amount: bidAmount,
          timestamp: now
        }
      }
    },
    { new: true }
  );

  if (!result) {
    const current = await this.findById(auctionId);
    return {
      error: 'BID_CONFLICT',
      message: 'Another higher bid was placed',
      currentHighestBid: current?.currentHighestBid,
      minBid: current?.getMinimumBid()
    };
  }

  return result;
};

module.exports = mongoose.model('Auction', auctionSchema);

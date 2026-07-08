const { Auctions, getNextUserNumber } = require('../store/db');

function setupSocketHandler(io) {
  io.on('connection', (socket) => {
    let oderId = socket.handshake.query.oderId;
    let odeerName = socket.handshake.query.odeerName;

    // If no existing user ID, assign a new sequential number
    if (!oderId || oderId === 'undefined' || oderId === 'null') {
      const userNum = getNextUserNumber();
      oderId = 'user_' + userNum;
      odeerName = 'User ' + userNum;
    }

    socket.oderId = oderId;
    socket.odeerName = odeerName;

    console.log(odeerName + ' connected (' + oderId + ')');
    socket.emit('user_assigned', { oderId, odeerName });

    // View auction (opens detail modal, starts auction if pending)
    socket.on('view_auction', (auctionId) => {
      let auction = Auctions.findById(auctionId);
      if (!auction) {
        socket.emit('error', { message: 'Auction not found' });
        return;
      }

      if (auction.status === 'pending') {
        const result = Auctions.startAuction(auctionId);
        if (result.error) {
          socket.emit('error', { message: result.error });
          return;
        }
        auction = result;
        console.log('Auction ' + auctionId + ' started by ' + odeerName);
        
        io.emit('auction_started', {
          auctionId: auction._id,
          status: auction.status,
          endsAt: auction.endsAt,
          startedBy: odeerName
        });
      }

      socket.join('auction:' + auctionId);

      const basePrice = auction.itemSnapshot?.basePrice || 0;
      const minIncrement = auction.itemSnapshot?.minIncrement || 10;
      const currentBid = auction.currentHighestBid || 0;
      const minimumBid = currentBid > 0 ? currentBid + minIncrement : basePrice;

      socket.emit('auction_state', {
        auctionId: auction._id,
        itemSnapshot: auction.itemSnapshot,
        currentHighestBid: auction.currentHighestBid,
        highestBidderId: auction.highestBidderId,
        highestBidderName: auction.highestBidderName,
        status: auction.status,
        endsAt: auction.endsAt,
        bidCount: auction.bidCount,
        bids: auction.bids || [],
        participants: auction.participants || [],
        minimumBid: minimumBid
      });
    });

    socket.on('participate_auction', (auctionId) => {
      const result = Auctions.addParticipant(auctionId, oderId, odeerName);
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }

      console.log(odeerName + ' is now participating in auction ' + auctionId);

      const participantData = {
        auctionId: auctionId,
        participant: { oderId, odeerName },
        participants: result.participants
      };

      socket.emit('participant_joined', participantData);
      socket.to('auction:' + auctionId).emit('participant_joined', participantData);
    });

    socket.on('leave_auction', (auctionId) => {
      socket.leave('auction:' + auctionId);
    });

    socket.on('place_bid', (data) => {
      const { auctionId, amount } = data;

      const result = Auctions.placeBid(auctionId, oderId, odeerName, amount);

      if (result.error) {
        socket.emit('bid_rejected', {
          error: result.error,
          message: result.error === 'NOT_A_PARTICIPANT' ? 'You must participate first' : result.error,
          currentHighestBid: result.currentHighestBid,
          minBid: result.minBid
        });
        return;
      }

      const minIncrement = result.itemSnapshot?.minIncrement || 10;
      const minimumBid = result.currentHighestBid + minIncrement;

      io.to('auction:' + auctionId).emit('bid_update', {
        auctionId: result._id,
        currentHighestBid: result.currentHighestBid,
        highestBidderId: result.highestBidderId,
        highestBidderName: result.highestBidderName,
        endsAt: result.endsAt,
        bidCount: result.bidCount,
        bids: result.bids,
        minimumBid: minimumBid
      });

      console.log(odeerName + ' bid $' + amount + ' on auction ' + auctionId);
    });

    socket.on('disconnect', () => {
      console.log(odeerName + ' disconnected');
    });
  });

  return io;
}

function broadcastAuctionClosed(io, auction) {
  io.emit('auction_closed', {
    auctionId: auction._id,
    winnerId: auction.winnerId,
    winnerName: auction.winnerName,
    finalBid: auction.winningBid
  });
}

module.exports = setupSocketHandler;
module.exports.broadcastAuctionClosed = broadcastAuctionClosed;

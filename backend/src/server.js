require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const setupSocketHandler = require('./socket/socketHandler');
const { broadcastAuctionClosed } = require('./socket/socketHandler');
const { Auctions } = require('./store/db');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

setupSocketHandler(io);
app.set('io', io);

// Check expired auctions every second
function checkExpiredAuctions() {
  try {
    const expired = Auctions.findExpired();

    for (const auction of expired) {
      const updated = Auctions.update(auction._id, {
        status: 'closed',
        closedAt: new Date().toISOString(),
        winnerId: auction.highestBidderId,
        winnerName: auction.highestBidderName,
        winningBid: auction.currentHighestBid
      });

      console.log('Auction closed. Winner: ' + (updated.winnerName || 'None'));
      broadcastAuctionClosed(io, updated);
    }
  } catch (error) {
    console.error('Error checking auctions:', error);
  }
}

setInterval(checkExpiredAuctions, 1000);

server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
  console.log('Using local JSON storage (no MongoDB required)');
});

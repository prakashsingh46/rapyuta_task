const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const AUCTIONS_FILE = path.join(DATA_DIR, 'auctions.json');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData(file) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading ' + file + ':', err);
  }
  return [];
}

function loadCounter() {
  try {
    if (fs.existsSync(COUNTER_FILE)) {
      return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading counter:', err);
  }
  return { userCounter: 0 };
}

function saveData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

const store = {
  items: loadData(ITEMS_FILE),
  auctions: loadData(AUCTIONS_FILE),
  counter: loadCounter()
};

// Get next user number
function getNextUserNumber() {
  store.counter.userCounter = (store.counter.userCounter || 0) + 1;
  saveData(COUNTER_FILE, store.counter);
  return store.counter.userCounter;
}

const Items = {
  findAll() { return [...store.items]; },
  findById(id) { return store.items.find(item => item._id === id) || null; },
  create(data) {
    const item = { _id: generateId(), ...data, createdAt: new Date().toISOString() };
    store.items.push(item);
    saveData(ITEMS_FILE, store.items);
    return item;
  },
  deleteAll() { store.items = []; saveData(ITEMS_FILE, store.items); },
  insertMany(items) {
    const created = items.map(data => ({ _id: generateId(), ...data, createdAt: new Date().toISOString() }));
    store.items.push(...created);
    saveData(ITEMS_FILE, store.items);
    return created;
  }
};

const Auctions = {
  findAll(filter = {}) {
    let results = [...store.auctions];
    if (filter.status) results = results.filter(a => a.status === filter.status);
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) { return store.auctions.find(a => a._id === id) || null; },

  findExpired() {
    const now = new Date();
    return store.auctions.filter(a => a.status === 'active' && new Date(a.endsAt) <= now);
  },

  create(data) {
    const auction = {
      _id: generateId(),
      currentHighestBid: 0,
      highestBidderId: null,
      highestBidderName: null,
      bidCount: 0,
      bids: [],
      participants: [],
      status: 'pending',
      endsAt: null,
      winnerId: null,
      winnerName: null,
      winningBid: null,
      closedAt: null,
      ...data,
      createdAt: new Date().toISOString()
    };
    store.auctions.push(auction);
    saveData(AUCTIONS_FILE, store.auctions);
    return auction;
  },

  update(id, updates) {
    const index = store.auctions.findIndex(a => a._id === id);
    if (index === -1) return null;
    store.auctions[index] = { ...store.auctions[index], ...updates };
    saveData(AUCTIONS_FILE, store.auctions);
    return store.auctions[index];
  },

  startAuction(auctionId) {
    const auction = this.findById(auctionId);
    if (!auction) return { error: 'AUCTION_NOT_FOUND' };
    if (auction.status === 'active') return auction;
    if (auction.status === 'closed') return { error: 'AUCTION_ALREADY_CLOSED' };

    const duration = auction.timerDuration || 60;
    return this.update(auctionId, {
      status: 'active',
      endsAt: new Date(Date.now() + duration * 1000).toISOString(),
      startedAt: new Date().toISOString()
    });
  },

  addParticipant(auctionId, oderId, odeerName) {
    const auction = this.findById(auctionId);
    if (!auction) return { error: 'AUCTION_NOT_FOUND' };
    
    const participants = auction.participants || [];
    if (participants.find(p => p.oderId === oderId)) {
      return auction;
    }
    
    participants.push({ oderId, odeerName, joinedAt: new Date().toISOString() });
    return this.update(auctionId, { participants });
  },

  placeBid(auctionId, oderId, oderName, bidAmount) {
    const auction = this.findById(auctionId);
    if (!auction) return { error: 'AUCTION_NOT_FOUND' };
    if (auction.status !== 'active') return { error: 'AUCTION_NOT_ACTIVE' };

    const now = new Date();
    if (new Date(auction.endsAt) <= now) return { error: 'AUCTION_ENDED' };

    const participants = auction.participants || [];
    if (!participants.find(p => p.oderId === oderId)) {
      return { error: 'NOT_A_PARTICIPANT' };
    }

    const basePrice = auction.itemSnapshot?.basePrice || 0;
    const minIncrement = auction.itemSnapshot?.minIncrement || 10;
    const currentBid = auction.currentHighestBid || 0;
    const minBid = currentBid > 0 ? currentBid + minIncrement : basePrice;

    if (bidAmount < minBid) {
      return { error: 'BID_TOO_LOW', minBid, currentHighestBid: currentBid };
    }

    const remainingTime = (new Date(auction.endsAt) - now) / 1000;
    let newEndsAt = auction.endsAt;
    const timerExtension = auction.timerExtension || 10;
    if (remainingTime < timerExtension) {
      newEndsAt = new Date(now.getTime() + timerExtension * 1000).toISOString();
    }

    return this.update(auctionId, {
      currentHighestBid: bidAmount,
      highestBidderId: oderId,
      highestBidderName: oderName,
      endsAt: newEndsAt,
      bidCount: (auction.bidCount || 0) + 1,
      bids: [...(auction.bids || []), { oderId, oderName, amount: bidAmount, timestamp: now.toISOString() }]
    });
  },

  deleteAll() { store.auctions = []; saveData(AUCTIONS_FILE, store.auctions); },

  insertMany(auctions) {
    const created = auctions.map(data => ({
      _id: generateId(),
      currentHighestBid: 0,
      highestBidderId: null,
      highestBidderName: null,
      bidCount: 0,
      bids: [],
      participants: [],
      winnerId: null,
      winnerName: null,
      winningBid: null,
      closedAt: null,
      ...data,
      createdAt: new Date().toISOString()
    }));
    store.auctions.push(...created);
    saveData(AUCTIONS_FILE, store.auctions);
    return created;
  }
};

module.exports = { Items, Auctions, generateId, getNextUserNumber };

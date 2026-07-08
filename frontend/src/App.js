import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import AuctionCard from './components/AuctionCard';
import AuctionModal from './components/AuctionModal';
import './App.css';

const SOCKET_URL = 'http://localhost:5000';
const API_URL = 'http://localhost:5000/api';

function getStoredUser() {
  const oderId = localStorage.getItem('oderId');
  const odeerName = localStorage.getItem('odeerName');
  if (oderId && odeerName) {
    return { oderId, odeerName };
  }
  return null;
}

function App() {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(getStoredUser() || { oderId: '', odeerName: 'Connecting...' });
  const [auctions, setAuctions] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected] = useState(false);
  const [selectedAuctionId, setSelectedAuctionId] = useState(null);
  const [participants, setParticipants] = useState({});

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const fetchAuctions = useCallback(async () => {
    try {
      const response = await fetch(API_URL + '/auctions');
      const data = await response.json();
      if (data.success && data.data) {
        const auctionsObj = {};
        data.data.forEach(auction => { auctionsObj[auction._id] = auction; });
        setAuctions(auctionsObj);
      }
    } catch (error) {
      console.error('Error fetching auctions:', error);
      addNotification('Failed to fetch auctions', 'error');
    }
  }, [addNotification]);

  useEffect(() => {
    const storedUser = getStoredUser();
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      query: storedUser ? { oderId: storedUser.oderId, odeerName: storedUser.odeerName } : {}
    });

    newSocket.on('connect', () => {
      setConnected(true);
      addNotification('Connected to auction server', 'success');
      fetchAuctions();
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      addNotification('Disconnected from server', 'error');
    });

    newSocket.on('user_assigned', (data) => {
      setUser(data);
      localStorage.setItem('oderId', data.oderId);
      localStorage.setItem('odeerName', data.odeerName);
    });

    newSocket.on('auction_state', (data) => {
      setAuctions(prev => ({
        ...prev,
        [data.auctionId]: { ...prev[data.auctionId], ...data, _id: data.auctionId }
      }));
      setParticipants(prev => ({
        ...prev,
        [data.auctionId]: data.participants || []
      }));
    });

    newSocket.on('auction_started', (data) => {
      setAuctions(prev => ({
        ...prev,
        [data.auctionId]: {
          ...prev[data.auctionId],
          status: data.status,
          endsAt: data.endsAt
        }
      }));
      addNotification('Auction started by ' + data.startedBy, 'info');
    });

    newSocket.on('participant_joined', (data) => {
      setParticipants(prev => ({
        ...prev,
        [data.auctionId]: data.participants
      }));
      addNotification(data.participant.odeerName + ' joined the auction', 'info');
    });

    newSocket.on('bid_update', (data) => {
      setAuctions(prev => ({
        ...prev,
        [data.auctionId]: {
          ...prev[data.auctionId],
          currentHighestBid: data.currentHighestBid,
          highestBidderId: data.highestBidderId,
          highestBidderName: data.highestBidderName,
          endsAt: data.endsAt,
          bidCount: data.bidCount,
          bids: data.bids,
          minimumBid: data.minimumBid
        }
      }));
      addNotification('New bid: $' + data.currentHighestBid + ' by ' + data.highestBidderName, 'info');
    });

    newSocket.on('bid_rejected', (data) => {
      addNotification('Bid rejected: ' + data.message, 'error');
    });

    newSocket.on('auction_closed', (data) => {
      setAuctions(prev => ({
        ...prev,
        [data.auctionId]: {
          ...prev[data.auctionId],
          status: 'closed',
          winnerId: data.winnerId,
          winnerName: data.winnerName,
          winningBid: data.finalBid
        }
      }));
      if (data.winnerName) {
        addNotification('Auction ended! Winner: ' + data.winnerName + ' with $' + data.finalBid, 'success');
      } else {
        addNotification('Auction ended with no bids', 'info');
      }
    });

    setSocket(newSocket);
    return () => newSocket.close();
  }, [addNotification, fetchAuctions]);

  const openAuction = useCallback((auctionId) => {
    if (socket && connected) {
      setSelectedAuctionId(auctionId);
      socket.emit('view_auction', auctionId);
    }
  }, [socket, connected]);

  const closeAuction = useCallback(() => {
    if (socket && selectedAuctionId) {
      socket.emit('leave_auction', selectedAuctionId);
    }
    setSelectedAuctionId(null);
  }, [socket, selectedAuctionId]);

  const participateInAuction = useCallback((auctionId) => {
    if (socket && connected) {
      socket.emit('participate_auction', auctionId);
    }
  }, [socket, connected]);

  const placeBid = useCallback((auctionId, amount) => {
    if (socket && connected && user) {
      socket.emit('place_bid', { auctionId, amount: parseFloat(amount) });
    }
  }, [socket, connected, user]);

  const selectedAuction = selectedAuctionId ? auctions[selectedAuctionId] : null;
  const currentParticipants = selectedAuctionId ? (participants[selectedAuctionId] || []) : [];

  return (
    <div className="app">
      <header className="header">
        <h1>Real-Time Auction House</h1>
        <div className="user-info">
          <span className="user-badge"><span className="user-icon">&#128100;</span> {user.odeerName}</span>
          <span className={'connection-status ' + (connected ? 'connected' : 'disconnected')}>
            {connected ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>

      <div className="notifications">
        {notifications.map(n => <div key={n.id} className={'notification ' + n.type}>{n.message}</div>)}
      </div>

      <main className="main-content">
        {Object.keys(auctions).length === 0 ? (
          <div className="no-auctions">
            <h2>No Items Available</h2>
            <p>Run in backend folder: node src/seed.js</p>
            <p>Then restart the backend server</p>
          </div>
        ) : (
          <div className="auctions-grid">
            {Object.values(auctions).map(auction => (
              <AuctionCard key={auction._id} auction={auction} onClick={openAuction} />
            ))}
          </div>
        )}
      </main>

      {selectedAuction && (
        <AuctionModal
          auction={selectedAuction}
          user={user}
          participants={currentParticipants}
          onClose={closeAuction}
          onParticipate={participateInAuction}
          onBid={placeBid}
        />
      )}

      <footer className="footer"><p>Real-Time Auction | Open multiple browsers to test</p></footer>
    </div>
  );
}

export default App;

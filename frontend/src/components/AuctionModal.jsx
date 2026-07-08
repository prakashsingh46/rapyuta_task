import React, { useState, useEffect, useCallback } from 'react';

function AuctionModal({ auction, user, participants, onClose, onParticipate, onBid }) {
  const [bidAmount, setBidAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  const isActive = auction.status === 'active';
  const isClosed = auction.status === 'closed';
  const isParticipant = participants.some(p => p.oderId === user.oderId);
  const isHighestBidder = auction.highestBidderId === user.oderId;
  const isWinner = isClosed && auction.winnerId === user.oderId;

  const itemName = auction.itemSnapshot?.name || 'Unknown Item';
  const itemDescription = auction.itemSnapshot?.description || '';
  const basePrice = auction.itemSnapshot?.basePrice || 0;
  const minIncrement = auction.itemSnapshot?.minIncrement || 10;
  const currentBid = auction.currentHighestBid || 0;
  const minBid = currentBid > 0 ? currentBid + minIncrement : basePrice;

  useEffect(() => {
    if (!auction.endsAt || !isActive) return;
    const calculateTimeLeft = () => {
      const end = new Date(auction.endsAt).getTime();
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTimeLeft(diff);
    };
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [auction.endsAt, isActive]);

  const formatTime = useCallback((seconds) => {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
  }, []);

  const handleBid = (e) => {
    e.preventDefault();
    const amount = parseFloat(bidAmount);
    if (amount >= minBid) {
      onBid(auction._id, amount);
      setBidAmount('');
    }
  };

  const getTimerClass = () => {
    if (timeLeft <= 5) return 'timer-critical';
    if (timeLeft <= 15) return 'timer-warning';
    return 'timer-normal';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-header">
          <h2>{itemName}</h2>
          <p className="modal-description">{itemDescription}</p>
          <div className={'modal-status ' + auction.status}>
            {isClosed ? 'Auction Closed' : (isActive ? 'Live Auction' : 'Starting...')}
          </div>
        </div>

        {/* Timer */}
        {isActive && (
          <div className={'modal-timer ' + getTimerClass()}>
            <span className="timer-icon">&#9202;</span>
            <span className="timer-value">{formatTime(timeLeft)}</span>
            {timeLeft <= 10 && <span className="timer-pulse"></span>}
          </div>
        )}

        {/* Current Bid Info */}
        <div className="modal-bid-info">
          <div className="bid-display">
            <span className="bid-label">{isClosed ? 'Final Bid' : 'Current Bid'}</span>
            <span className="bid-amount">${currentBid || basePrice}</span>
          </div>
          {auction.highestBidderName && (
            <div className={'bidder-display ' + (isHighestBidder ? 'is-you' : '')}>
              <span className="bidder-label">{isClosed ? 'Winner' : 'Leading'}</span>
              <span className="bidder-name">{isHighestBidder ? 'You!' : auction.highestBidderName}</span>
            </div>
          )}
        </div>

        {/* Winner Display */}
        {isClosed && (
          <div className={'modal-winner ' + (isWinner ? 'is-you' : '')}>
            {auction.winnerName ? (
              <>
                <span className="winner-icon">&#127942;</span>
                <span className="winner-text">{isWinner ? 'Congratulations! You Won!' : 'Winner: ' + auction.winnerName}</span>
                <span className="final-price">Final Price: ${auction.winningBid}</span>
              </>
            ) : (
              <span className="no-winner">No bids were placed</span>
            )}
          </div>
        )}

        {/* Participants Section */}
        <div className="modal-participants">
          <h4>Participants ({participants.length})</h4>
          <div className="participants-list">
            {participants.length === 0 ? (
              <span className="no-participants">No participants yet</span>
            ) : (
              participants.map((p, i) => (
                <span key={i} className={'participant-badge ' + (p.oderId === user.oderId ? 'is-you' : '')}>
                  {p.oderId === user.oderId ? 'You' : p.odeerName}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        {isActive && (
          <div className="modal-actions">
            {!isParticipant ? (
              <button className="participate-btn" onClick={() => onParticipate(auction._id)}>
                Participate in Auction
              </button>
            ) : (
              <form className="modal-bid-form" onSubmit={handleBid}>
                <div className="bid-input-group">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={'Min: $' + minBid}
                    min={minBid}
                    step="1"
                    className="bid-input"
                  />
                </div>
                <button type="submit" className="bid-btn" disabled={!bidAmount || parseFloat(bidAmount) < minBid}>
                  Place Bid
                </button>
              </form>
            )}
          </div>
        )}

        {/* Bid History */}
        {(auction.bids && auction.bids.length > 0) && (
          <div className="modal-bid-history">
            <h4>Bid History ({auction.bids.length})</h4>
            <div className="bids-list">
              {[...auction.bids].reverse().slice(0, 10).map((bid, i) => (
                <div key={i} className={'bid-item ' + (bid.oderId === user.oderId ? 'your-bid' : '')}>
                  <span className="bid-name">{bid.oderId === user.oderId ? 'You' : bid.oderName}</span>
                  <span className="bid-value">${bid.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          Base Price: ${basePrice} | Min Increment: ${minIncrement}
        </div>
      </div>
    </div>
  );
}

export default AuctionModal;

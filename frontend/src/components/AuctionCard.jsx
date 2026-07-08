import React from "react";

function AuctionCard({ auction, onClick }) {
  const itemName = auction.itemSnapshot?.name || "Unknown Item";
  const itemDescription = auction.itemSnapshot?.description || "";
  const basePrice = auction.itemSnapshot?.basePrice || 0;
  const currentBid = auction.currentHighestBid || 0;
  const isPending = auction.status === "pending";
  const isActive = auction.status === "active";
  const isClosed = auction.status === "closed";

  const getStatusBadge = () => {
    if (isPending) return "Available";
    if (isActive) return "Live";
    return "Closed";
  };

  const displayPrice = currentBid > 0 ? currentBid : basePrice;

  return (
    <div className={"auction-card clickable " + auction.status} onClick={() => onClick(auction._id)}>
      <div className={"status-badge " + auction.status}>{getStatusBadge()}</div>

      <div className="auction-header">
        <h3 className="auction-title">{itemName}</h3>
        <p className="auction-description">{itemDescription}</p>
      </div>

      <div className="card-price">
        <span className="price-label">{isClosed ? "Final Price" : (currentBid > 0 ? "Current Bid" : "Starting Price")}</span>
        <span className="price-value">${displayPrice}</span>
      </div>

      {auction.highestBidderName && !isClosed && (
        <div className="highest-bidder-preview">
          Leading: {auction.highestBidderName}
        </div>
      )}

      {isClosed && auction.winnerName && (
        <div className="winner-preview">
          Winner: {auction.winnerName}
        </div>
      )}

      <div className="card-footer">
        <span className="click-hint">{isClosed ? "View Results" : "Click to Bid"}</span>
      </div>
    </div>
  );
}

export default AuctionCard;

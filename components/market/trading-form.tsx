"use client";

import { useState } from "react";

interface TradingFormProps {
  marketType?: "spot" | "perp";
}

/**
 * Trading Form Component
 * Handles Buy/Sell orders with Market/Limit options
 * Ready for backend integration and wallet confirmation
 */
export default function TradingForm({ marketType = "spot" }: TradingFormProps) {
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [orderType, setOrderType] = useState<"Market" | "Limit">("Market");
  const [orderValue, setOrderValue] = useState("0");
  const [percentage, setPercentage] = useState(0);

  // Available balance (will come from wallet/API)
  const availableBalance = "10 USDT";

  // Calculate order details based on value
  const calculateOrderDetails = () => {
    const value = parseFloat(orderValue) || 0;
    // In real implementation, these would be calculated from current price and order value
    return {
      value: value > 0 ? `$${value.toFixed(2)}` : "-",
      quantity: value > 0 ? "0.00000000" : "-", // Would calculate from price
      fee: value > 0 ? "0.00" : "-", // Would calculate fee percentage
    };
  };

  const orderDetails = calculateOrderDetails();

  // Handle percentage slider
  const handlePercentageClick = (percent: number) => {
    setPercentage(percent);
    // Calculate order value based on percentage of available balance
    const balance = parseFloat(availableBalance.replace(" USDT", "")) || 0;
    const calculatedValue = (balance * percent) / 100;
    setOrderValue(calculatedValue.toFixed(2));
  };

  // Handle trade execution (will trigger wallet confirmation)
  const handleTrade = async () => {
    // TODO: Integrate with backend
    // 1. Validate order
    // 2. Show wallet confirmation modal
    // 3. Execute trade
    // 4. Track for analytics
    console.log("Execute trade:", { side, orderType, orderValue, marketType });
    
    // Placeholder for wallet confirmation
    // In real implementation:
    // - Check wallet connection
    // - Show confirmation modal with order details
    // - Call backend API to create order
    // - Handle transaction signing
    // - Track trade for analytics
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-3 xl:gap-3.5 2xl:gap-4 items-center w-full">
      {/* Buy/Sell Toggle */}
      <div className="bg-[#0b0f0a] flex items-center p-1 lg:p-0.5 xl:p-0.5 2xl:p-1 rounded-lg lg:rounded-md xl:rounded-md 2xl:rounded-lg w-full">
        <button
          onClick={() => setSide("Buy")}
          className={`flex-1 flex items-end justify-center px-4 lg:px-3 xl:px-3.5 2xl:px-4 py-2.25 lg:py-1.75 xl:py-2 2xl:py-2.25 rounded-md lg:rounded-sm xl:rounded-sm 2xl:rounded-md transition-colors cursor-pointer ${
            side === "Buy"
              ? "bg-[#b1f128] text-[#010501] font-semibold"
              : "text-[#b5b5b5] font-semibold hover:text-white"
          }`}
        >
          <span className="text-base lg:text-sm xl:text-sm 2xl:text-base leading-normal">Buy</span>
        </button>
        <button
          onClick={() => setSide("Sell")}
          className={`flex-1 flex flex-col gap-4 lg:gap-3 xl:gap-3.5 2xl:gap-4 items-center py-2.25 lg:py-1.75 xl:py-2 2xl:py-2.25 rounded-md lg:rounded-sm xl:rounded-sm 2xl:rounded-md transition-colors cursor-pointer ${
            side === "Sell"
              ? "bg-[#b1f128] text-[#010501] font-semibold"
              : "text-[#b5b5b5] font-semibold hover:text-white"
          }`}
        >
          <span className="text-base lg:text-sm xl:text-sm 2xl:text-base leading-normal">Sell</span>
        </button>
      </div>

      {/* Market/Limit Tabs */}
      <div className="flex gap-4 lg:gap-3 xl:gap-3.5 2xl:gap-4 items-center w-full">
        <button
          onClick={() => setOrderType("Market")}
          className={`flex items-end justify-center py-1.25 lg:py-1 xl:py-1 2xl:py-1.25 transition-colors cursor-pointer ${
            orderType === "Market"
              ? "text-[#b1f128] font-semibold"
              : "text-[#8f8f8f] font-semibold hover:text-[#b5b5b5]"
          }`}
        >
          <span className="text-base lg:text-sm xl:text-sm 2xl:text-base leading-normal">Market</span>
        </button>
        <button
          onClick={() => setOrderType("Limit")}
          className={`flex items-end justify-center py-1.25 lg:py-1 xl:py-1 2xl:py-1.25 transition-colors cursor-pointer ${
            orderType === "Limit"
              ? "text-[#b1f128] font-semibold"
              : "text-[#8f8f8f] font-semibold hover:text-[#b5b5b5]"
          }`}
        >
          <span className="text-base lg:text-sm xl:text-sm 2xl:text-base leading-normal">Limit</span>
        </button>
      </div>

      {/* Order Value Input */}
      <div className="flex flex-col gap-2 lg:gap-1.5 xl:gap-1.5 2xl:gap-2 items-start w-full">
        <div className="bg-[#1f261e] flex items-center justify-between px-3 lg:px-2.5 xl:px-2.5 2xl:px-3 py-3.25 lg:py-2.5 xl:py-3 2xl:py-3.25 rounded-lg lg:rounded-md xl:rounded-md 2xl:rounded-lg w-full">
          <input
            type="text"
            value={orderValue}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9.]/g, "");
              setOrderValue(value);
            }}
            placeholder="0"
            className="bg-transparent text-[#b5b5b5] text-base lg:text-sm xl:text-sm 2xl:text-base font-medium outline-none w-full"
          />
          <span className="text-[#b5b5b5] text-base lg:text-sm xl:text-sm 2xl:text-base font-medium">USD</span>
        </div>
        
        {/* Available Balance */}
        <div className="flex items-center justify-between w-full">
          <span className="text-[#8f8f8f] text-sm lg:text-xs xl:text-xs 2xl:text-sm font-medium">Available</span>
          <span className="text-white text-sm lg:text-xs xl:text-xs 2xl:text-sm font-semibold">{availableBalance}</span>
        </div>
      </div>

      {/* Percentage Slider - Draggable Range Input */}
      <div className="flex gap-2.5 lg:gap-2 xl:gap-2 2xl:gap-2.5 items-center px-0 py-3.5 lg:py-2.5 xl:py-3 2xl:py-3.5 relative w-full">
        <div className="bg-[#1f261e] flex-1 h-1 lg:h-0.5 xl:h-0.5 2xl:h-1 rounded-2xl lg:rounded-xl xl:rounded-xl 2xl:rounded-2xl relative">
          {/* Range Input - Draggable */}
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={percentage}
            onChange={(e) => {
              const newPercentage = parseInt(e.target.value);
              setPercentage(newPercentage);
              const balance = parseFloat(availableBalance.replace(" USDT", "")) || 0;
              const calculatedValue = (balance * newPercentage) / 100;
              setOrderValue(calculatedValue.toFixed(2));
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            style={{ WebkitAppearance: 'none', appearance: 'none' }}
          />
          
          {/* Visual track fill */}
          <div
            className="absolute left-0 top-0 h-full bg-[#b1f128] rounded-2xl xl:rounded-xl 2xl:rounded-2xl transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Slider markers */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-between w-[332px] lg:w-[241px] xl:w-[271px] 2xl:w-[332px] pointer-events-none">
            {[0, 25, 50, 75, 100].map((percent) => (
              <div
                key={percent}
                className={`rounded-lg lg:rounded-md xl:rounded-md 2xl:rounded-lg shrink-0 transition-all ${
                  percentage >= percent
                    ? "bg-[#b1f128] border-2 lg:border-[1.5px] xl:border-[1.5px] 2xl:border-2 border-[#156200] size-[18px] lg:size-[13px] xl:size-[14px] 2xl:size-[18px]"
                    : "bg-[#1f261e] border-2 lg:border-[1.5px] xl:border-[1.5px] 2xl:border-2 border-[#010501] size-[14px] lg:size-[10px] xl:size-[11px] 2xl:size-[14px]"
                }`}
              />
            ))}
          </div>
          
          {/* Active percentage indicator - Positioned dynamically based on percentage */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 lg:w-3 lg:h-3 xl:w-3.5 xl:h-3.5 2xl:w-4 2xl:h-4 bg-[#b1f128] border-2 lg:border-[1.5px] xl:border-[1.5px] 2xl:border-2 border-[#156200] rounded-full pointer-events-none z-10 transition-all duration-150"
            style={{ 
              left: `max(0px, min(100%, calc(${percentage}% - ${percentage <= 25 ? '6px' : percentage <= 50 ? '7px' : '8px'})))`, 
              transform: 'translateY(-50%)' 
            }}
          />
        </div>
      </div>

      {/* Order Summary */}
      <div className="border border-[#1f261e] flex flex-col gap-1 lg:gap-0.5 xl:gap-0.5 2xl:gap-1 items-start p-3 lg:p-2.5 xl:p-2.5 2xl:p-3 rounded-lg lg:rounded-md xl:rounded-md 2xl:rounded-lg w-full">
        <div className="flex items-center justify-between w-full text-[#b5b5b5] font-medium">
          <span className="text-sm lg:text-xs xl:text-xs 2xl:text-sm">Value</span>
          <span className="text-base lg:text-sm xl:text-sm 2xl:text-base">{orderDetails.value}</span>
        </div>
        <div className="flex items-center justify-between w-full text-[#b5b5b5] font-medium">
          <span className="text-sm lg:text-xs xl:text-xs 2xl:text-sm">Quantity</span>
          <span className="text-base lg:text-sm xl:text-sm 2xl:text-base">{orderDetails.quantity}</span>
        </div>
        <div className="flex items-center justify-between w-full text-[#b5b5b5] font-medium">
          <span className="text-sm lg:text-xs xl:text-xs 2xl:text-sm">Fee</span>
          <span className="text-base lg:text-sm xl:text-sm 2xl:text-base">{orderDetails.fee}</span>
        </div>
      </div>

      {/* Buy/Sell Button */}
      <button
        onClick={handleTrade}
        className={`bg-[#156200] flex h-12 lg:h-10 xl:h-11 2xl:h-12 items-center justify-between px-6 lg:px-5 xl:px-5 2xl:px-6 py-2.875 lg:py-2.5 xl:py-2.75 2xl:py-2.875 rounded-full w-full cursor-pointer hover:opacity-90 transition-opacity ${
          parseFloat(orderValue) > 0 ? "" : "opacity-50 cursor-not-allowed"
        }`}
        disabled={parseFloat(orderValue) <= 0}
      >
        <span className="text-white text-lg lg:text-base xl:text-base 2xl:text-lg font-semibold leading-normal tracking-[0.018px]">
          {side}
        </span>
      </button>
    </div>
  );
}


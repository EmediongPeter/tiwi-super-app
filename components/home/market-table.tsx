import Image from "next/image";
import { TABLE_TOKENS } from "@/lib/home/mock-data";

export function MarketTable() {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="overflow-x-auto market-table-scrollbar flex-1 min-h-0">
        <div className="min-w-[46.875rem] lg:min-w-[50rem] xl:min-w-[53.125rem] 2xl:min-w-[56.25rem] h-full flex flex-col">
          {/* Header - Fixed */}
          <div className="border-b border-[#1f261e]/80 flex items-center justify-between px-3 lg:px-4 xl:px-5 2xl:px-6 py-1.5 lg:py-2 text-[10px] lg:text-xs xl:text-sm text-[#7c7c7c] font-semibold shrink-0">
            <div className="w-[6.5rem] lg:w-[7rem] xl:w-[8.125rem] 2xl:w-[8.75rem] text-left">Token</div>
            <div className="w-[5rem] lg:w-[5.5rem] xl:w-[6.5625rem] 2xl:w-[6.875rem] text-right">Price</div>
            <div className="w-[5rem] lg:w-[5.5rem] xl:w-[6.5625rem] 2xl:w-[6.875rem] text-right">24h Change</div>
            <div className="w-[5.5rem] lg:w-[6rem] xl:w-[6.875rem] 2xl:w-[7.5rem] text-right">24h Vol</div>
            <div className="w-[5rem] lg:w-[5.5rem] xl:w-[6.5625rem] 2xl:w-[6.875rem] text-right">Liquidity</div>
            <div className="w-[4.5rem] lg:w-[4.75rem] xl:w-[5.3125rem] 2xl:w-[5.625rem] text-right">Holders</div>
            <div className="w-[4.5rem] lg:w-[4.75rem] xl:w-[5.3125rem] 2xl:w-[5.625rem] text-right">Buy/Sell</div>
          </div>

          {/* Scrollable rows - Takes remaining height */}
          <div className="flex-1 overflow-y-auto market-table-scrollbar min-h-0">
          {TABLE_TOKENS.map((token) => (
            <div
              key={token.symbol}
              className="border-b border-[#1f261e]/60 flex items-center justify-between px-3 lg:px-4 xl:px-5 2xl:px-6 py-2.5 lg:py-3 xl:py-4 hover:bg-[#0b0f0a] transition-colors"
            >
              <div className="w-[6.5rem] lg:w-[7rem] xl:w-[8.125rem] 2xl:w-[8.75rem] flex items-center gap-1 lg:gap-1.5 xl:gap-2.5 2xl:gap-3 text-white text-[10px] lg:text-xs xl:text-base font-semibold">
                <Image
                  src="/assets/icons/home/star.svg"
                  alt="star"
                  width={12}
                  height={12}
                  className="lg:w-4 lg:h-4 xl:w-5 xl:h-5"
                />
                <Image src={token.icon} alt={token.symbol} width={20} height={20} className="lg:w-6 lg:h-6 xl:w-8 xl:h-8" />
                <span className="truncate">{token.symbol}</span>
              </div>
              <div className="w-[5rem] lg:w-[5.5rem] xl:w-[6.5625rem] 2xl:w-[6.875rem] text-right text-white text-[10px] lg:text-xs xl:text-base font-medium">{token.price}</div>
              <div
                className={`w-[5rem] lg:w-[5.5rem] xl:w-[6.5625rem] 2xl:w-[6.875rem] text-right text-[10px] lg:text-xs xl:text-base font-medium ${
                  token.changePositive ? "text-[#3fea9b]" : "text-[#ff5c5c]"
                }`}
              >
                {token.change}
              </div>
              <div className="w-[5.5rem] lg:w-[6rem] xl:w-[6.875rem] 2xl:w-[7.5rem] text-right text-white text-[10px] lg:text-xs xl:text-base font-medium">{token.vol}</div>
              <div className="w-[5rem] lg:w-[5.5rem] xl:w-[6.5625rem] 2xl:w-[6.875rem] text-right text-white text-[10px] lg:text-xs xl:text-base font-medium">{token.liq}</div>
              <div className="w-[4.5rem] lg:w-[4.75rem] xl:w-[5.3125rem] 2xl:w-[5.625rem] text-right text-white text-[10px] lg:text-xs xl:text-base font-medium">{token.holders}</div>
              <div className="w-[4.5rem] lg:w-[4.75rem] xl:w-[5.3125rem] 2xl:w-[5.625rem] flex justify-end">
                <button
                  className="w-7 h-7 lg:w-8 lg:h-8 xl:w-10 xl:h-10 2xl:w-12 2xl:h-12 rounded-full flex items-center justify-center p-0 cursor-pointer bg-transparent"
                >
                  <Image
                    src="/assets/icons/home/trade.svg"
                    alt="trade"
                    width={24}
                    height={24}
                    className="w-full h-full opacity-90 lg:w-8 lg:h-8 xl:w-10 xl:h-10 2xl:w-12 2xl:h-12"
                  />
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}


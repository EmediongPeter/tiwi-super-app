"use client";

/**
 * Stake Card Component
 * Displays "Stake to earn $TWC" promotional card
 */
export default function StakeCard() {
  return (
    <div className="border border-[#1f261e] rounded-2xl lg:rounded-xl xl:rounded-xl 2xl:rounded-2xl p-6 lg:p-4 xl:p-4.5 2xl:p-6 relative overflow-hidden">
      {/* Background decorative elements would go here */}
      
      <div className="flex flex-col items-start justify-center text-center relative">
        <p className="text-[#b5b5b5] text-base lg:text-sm xl:text-sm 2xl:text-base font-medium leading-normal">
          Stake to earn
        </p>
        <p className="text-white text-2xl lg:text-lg xl:text-xl 2xl:text-2xl font-bold leading-normal">
          <span className="text-[#b1f128]">$</span>TWC
        </p>
      </div>
    </div>
  );
}


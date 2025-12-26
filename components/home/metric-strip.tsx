import Image from "next/image";

interface MetricStripProps {
  className?: string;
}

const chainAvatars = [
  "https://www.figma.com/api/mcp/asset/288c729d-b7b9-4d02-997e-2e37a66b04d7",
  "https://www.figma.com/api/mcp/asset/619149f5-4a81-46a2-9299-635efd0930ee",
  "https://www.figma.com/api/mcp/asset/3d8d555b-2636-4b99-bb28-4404b6d2b776",
  "https://www.figma.com/api/mcp/asset/5aea5092-08b0-4b7c-a286-1c93b2c2104e",
  "https://www.figma.com/api/mcp/asset/46c83a2a-98d5-4307-9c12-0b6f24735a5d",
  "https://www.figma.com/api/mcp/asset/d800787d-efde-4556-b5cf-905902e42a21",
  "https://www.figma.com/api/mcp/asset/e120a6cb-10b3-4880-8206-13e3b6bf316b",
  "https://www.figma.com/api/mcp/asset/a82282c6-5f21-4e48-a0f1-eb98def55ec8",
  "https://www.figma.com/api/mcp/asset/29173894-52fa-454e-93b3-558f8e4a58e8",
];

export function MetricStrip({ className = "" }: MetricStripProps) {
  return (
    <div
      className={`w-full border-b border-[#1f261e] flex items-center justify-between px-10 py-3 gap-10 ${className}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-white text-lg font-semibold">50+</span>
          <span className="text-[#b5b5b5] text-base font-medium">Active Chains</span>
        </div>
        <div className="h-12 w-px bg-[#1f261e]" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden border border-[#010501]">
              <Image src="https://www.figma.com/api/mcp/asset/288c729d-b7b9-4d02-997e-2e37a66b04d7" alt="TWC" width={24} height={24} />
            </div>
            <span className="text-white text-sm font-semibold">TWC</span>
            <span className="text-[#b5b5b5] text-sm font-medium">$0.095</span>
            <span className="text-[#ff5c5c] text-sm font-medium">-12.1%</span>
          </div>
        </div>
        <div className="h-12 w-px bg-[#1f261e]" />
        <div className="flex items-center gap-3">
          {chainAvatars.map((src, idx) => (
            <div
              key={src}
              className="w-6 h-6 rounded-full overflow-hidden border-2 border-[#010501]"
              style={{ marginLeft: idx === 0 ? 0 : -8 }}
            >
              <Image src={src} alt={`chain-${idx}`} width={24} height={24} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-white text-lg font-semibold">20+</span>
          <span className="text-[#b5b5b5] text-base font-medium">Smart Markets</span>
        </div>
        <div className="h-12 w-px bg-[#1f261e]" />
        <div className="flex items-center gap-2">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="w-6 h-6 rounded-full overflow-hidden border-2 border-[#010501]"
              style={{ marginLeft: idx === 0 ? 0 : -8 }}
            >
              <Image src={chainAvatars[idx % chainAvatars.length]} alt={`market-${idx}`} width={24} height={24} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


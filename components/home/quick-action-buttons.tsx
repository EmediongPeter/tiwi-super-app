import Image from "next/image";
import { SIDEBAR_ICONS } from "@/lib/home/mock-data";

interface QuickAction {
  label: string;
  icon: string;
  href?: string;
}

const actions: QuickAction[] = [
  { label: "Swap", icon: SIDEBAR_ICONS.swap },
  { label: "Stake", icon: SIDEBAR_ICONS.stake },
  { label: "Pool", icon: SIDEBAR_ICONS.lend },
  { label: "History", icon: SIDEBAR_ICONS.history },
  { label: "More", icon: SIDEBAR_ICONS.support },
];

export function QuickActionButtons() {
  return (
    <div className="flex items-center justify-between w-full px-0">
      {actions.map((action) => (
        <div key={action.label} className="flex flex-col items-center justify-center gap-2 w-[51px]">
          <div className="bg-[#121712] flex items-center justify-center p-2 rounded-xl">
            <Image
              src={action.icon}
              alt={action.label}
              width={24}
              height={24}
              className="w-6 h-6"
            />
          </div>
          <p className="text-white text-sm font-medium text-center leading-normal">
            {action.label}
          </p>
        </div>
      ))}
    </div>
  );
}


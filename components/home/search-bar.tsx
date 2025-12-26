import Image from "next/image";

export function SearchBar() {
  return (
    <div className="bg-[#0b0f0a] border border-[#1f261e] rounded-full px-3 lg:px-4 py-2 lg:py-3 flex items-center gap-2 lg:gap-3 w-full max-w-[17.5rem] lg:max-w-[20rem] xl:max-w-[22.5rem] 2xl:max-w-[26.5rem]">
      <Image
        src="/assets/icons/search-01.svg"
        alt="Search"
        width={16}
        height={16}
        className="shrink-0 lg:w-5 lg:h-5"
      />
      <input
        placeholder="Search by tokens"
        className="bg-transparent text-xs lg:text-sm text-[#7c7c7c] outline-none w-full"
      />
    </div>
  );
}


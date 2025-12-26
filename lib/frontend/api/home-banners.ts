/**
 * Home banner API (frontend mock)
 *
 * In production this would call a backend endpoint to fetch
 * active promotional banners configured from the admin.
 * Here we mimic that behaviour with a small async helper.
 */

import { HERO_ART } from "@/lib/home/mock-data";

export interface HomeBanner {
  id: string;
  imageUrl: string;
  alt: string;
  href?: string;
  order: number;
}

// Simulated backend fetch
export async function fetchHomeBanners(): Promise<HomeBanner[]> {
  // Simulate small network delay
  await new Promise((resolve) => setTimeout(resolve, 150));

  return [
    {
      id: "fomo-friday",
      imageUrl: HERO_ART.shield,
      alt: "FOMO Friday — Trade TWC, Stake TWC, 25,000 TWC",
      href: undefined,
      order: 1,
    },
    {
      id: "stake-twc-yield",
      imageUrl: "/assets/icons/home/hero-banner-stake.svg",
      alt: "Stake TWC to earn yield across chains",
      href: undefined,
      order: 2,
    },
    {
      id: "smart-markets",
      imageUrl: "/assets/icons/home/hero-banner-markets.svg",
      alt: "Discover smart markets powered by Tiwi Protocol",
      href: undefined,
      order: 3,
    },
  ];
}



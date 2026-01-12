/**
 * TradingView Chart Component
 * 
 * Reusable React component for displaying TradingView charts.
 * 
 * @example
 * ```tsx
 * <TradingViewChart
 *   baseToken="0xDA1060158F7D593667cCE0a15DB346BB3FfB3596"
 *   quoteToken="0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
 *   chainId={56}
 *   height="600px"
 *   theme="dark"
 * />
 * ```
 */

'use client';

import { useEffect, useRef } from 'react';
// @ts-ignore - TradingView library types
import { widget } from '@/charting_library';
import type { IChartingLibraryWidget } from '@/charting_library/charting_library';
import { TradingViewDatafeed } from '@/lib/frontend/charts/tradingview-datafeed';
import { ResolutionString } from '@/charting_library/charting_library/charting_library';
import { formatPriceForChart } from '@/lib/shared/utils/price-formatting-subscript';

// ============================================================================
// Component Props
// ============================================================================

export interface TradingViewChartProps {
  baseToken: string; // Token address
  quoteToken: string; // Token address (or native token like 0x000...)
  chainId?: number; // For backward compatibility (same-chain pairs)
  baseChainId?: number; // Base token chain ID (for cross-chain support)
  quoteChainId?: number; // Quote token chain ID (for cross-chain support)
  height?: string | number;
  theme?: 'light' | 'dark';
  interval?: ResolutionString;
  onError?: (error: Error) => void;
  onReady?: () => void;
  className?: string;
}

// ============================================================================
// TradingView Chart Component
// ============================================================================

export function TradingViewChart({
  baseToken,
  quoteToken,
  chainId, // For backward compatibility
  baseChainId, // For cross-chain support
  quoteChainId, // For cross-chain support
  height = '600px',
  theme = 'dark',
  interval = '15' as ResolutionString,
  onError,
  onReady,
  className,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<IChartingLibraryWidget | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Determine if this is a cross-chain pair
    const resolvedBaseChainId = baseChainId || chainId;
    const resolvedQuoteChainId = quoteChainId || chainId;
    const isCrossChain = resolvedBaseChainId !== resolvedQuoteChainId;

    // Create symbol identifier
    // Same-chain: baseAddress-quoteAddress-chainId (backward compatible)
    // Cross-chain: baseAddress-baseChainId-quoteAddress-quoteChainId
    const symbol = isCrossChain
      ? `${baseToken}-${resolvedBaseChainId}-${quoteToken}-${resolvedQuoteChainId}`
      : `${baseToken}-${quoteToken}-${resolvedBaseChainId}`;

    // Initialize datafeed
    const datafeed = new TradingViewDatafeed();

    // Widget options
    const widgetOptions = {
      symbol,
      datafeed,
      interval: interval as ResolutionString,
      container: chartContainerRef.current,
      library_path: '/charts/charting_library/',
      locale: 'en',
      disabled_features: [
        'use_localstorage_for_settings',
        'volume_force_overlay',
        'create_volume_indicator_by_default',
      ] as any,
      enabled_features: [
        'study_templates',
        'side_toolbar_in_fullscreen_mode',
      ] as any,
      charts_storage_url: 'https://saveload.tradingview.com',
      charts_storage_api_version: '1.1',
      client_id: 'tiwi-protocol',
      user_id: 'public_user_id',
      fullscreen: false,
      autosize: true,
      studies_overrides: {},
      theme,
      custom_css_url: '/charts/charting_library/custom.css',
      overrides: {
        'paneProperties.background': theme === 'dark' ? '#010501' : '#ffffff',
        'paneProperties.backgroundType': 'solid',
        'mainSeriesProperties.candleStyle.upColor': '#3fea9b',
        'mainSeriesProperties.candleStyle.downColor': '#ff5c5c',
        'mainSeriesProperties.candleStyle.borderUpColor': '#3fea9b',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ff5c5c',
        'mainSeriesProperties.candleStyle.wickUpColor': '#3fea9b',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ff5c5c',
      },
      loading_screen: {
        backgroundColor: theme === 'dark' ? '#010501' : '#ffffff',
      },
      custom_formatters: {
        timeFormatter: {
          format: (date: Date) => {
            return date.toLocaleString();
          },
        },
        // Price formatter factory - creates a formatter for the price axis and OHLC values
        priceFormatterFactory: (symbolInfo: any, minTick: string) => {
          return {
            format: (price: number) => {
              // Format price with subscript notation for very small values
              // This formats:
              // 1. Price axis labels on the right side
              // 2. OHLC values (O, H, L, C) displayed when hovering/selecting candles
              return formatPriceForChart(price);
            },
            parse: (value: string) => {
              // Parse formatted price back to number
              // Remove subscript notation and convert back
              try {
                return parseFloat(value.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (char) => {
                  const subscriptMap: Record<string, string> = {
                    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
                    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
                  };
                  return subscriptMap[char] || char;
                }));
              } catch {
                return parseFloat(value) || 0;
              }
            },
          };
        },
        volumeFormatter: {
          format: (volume: number) => {
            // Format volume with subscript notation if needed
            if (volume < 0.000001) {
              return formatPriceForChart(volume);
            }
            // For larger volumes, use standard formatting
            if (volume >= 1000000) {
              return `${(volume / 1000000).toFixed(2)}M`;
            } else if (volume >= 1000) {
              return `${(volume / 1000).toFixed(2)}K`;
            }
            return volume.toFixed(2);
          },
        },
      },
    };

    try {
      // Create widget
      // @ts-ignore - TradingView widget options type is complex, our options are valid
      const tvWidget = new widget(widgetOptions as any);
      widgetRef.current = tvWidget;

      // Handle chart ready
      tvWidget.onChartReady(() => {
        console.log('[TradingViewChart] Chart ready');
        
        // Auto-scale price axis
        try {
          const chart = tvWidget.activeChart();
          const priceScale = chart.getPanes()[0]?.getMainSourcePriceScale();
          if (priceScale) {
            priceScale.setAutoScale(true);
          }
        } catch (error) {
          console.warn('[TradingViewChart] Could not set auto-scale:', error);
        }
        
        // Call onReady callback if provided
        if (onReady) {
          onReady();
        }
      });

      // Cleanup function
      return () => {
        if (tvWidget) {
          console.log('[TradingViewChart] Removing widget');
          tvWidget.remove();
          widgetRef.current = null;
        }
      };
    } catch (error) {
      console.error('[TradingViewChart] Error initializing widget:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }, [baseToken, quoteToken, chainId, baseChainId, quoteChainId, interval, theme]); // Note: onError and onReady are callbacks, not dependencies

  return (
    <div
      ref={chartContainerRef}
      className={className}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: '100%',
      }}
    />
  );
}


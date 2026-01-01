import { useEffect, useRef } from "react";
import { parseNumber } from "@/lib/shared/utils/number";
import { fetchRoute } from "@/lib/frontend/api/route";
import { useSwapStore } from "@/lib/frontend/store/swap-store";
import { useSettingsStore } from "@/lib/frontend/store/settings-store";
import type { Token } from "@/lib/frontend/types/tokens";
import { RouterRoute } from "@/lib/backend/routers";

interface UseSwapQuoteOptions {
  fromAmount: string;
  activeTab: "swap" | "limit";
  fromToken: Token | null;
  toToken: Token | null;
  delay?: number; // Debounce delay in ms (default: 500)
}

/**
 * Custom hook for fetching swap quotes
 * Handles debouncing, loading states, and API calls
 * Updates Zustand store with quote results
 */
export function useSwapQuote({
  fromAmount,
  activeTab,
  fromToken,
  toToken,
  delay = 500,
}: UseSwapQuoteOptions): void {
  const setRoute = useSwapStore((state) => state.setRoute);
  const setToAmount = useSwapStore((state) => state.setToAmount);
  const setQuoteLoading = useSwapStore((state) => state.setQuoteLoading);
  const setQuoteError = useSwapStore((state) => state.setQuoteError);
  // Note: Do NOT read route here - it's stale. Use getState() for debugging only.
  // Get user slippage settings
  const slippageMode = useSettingsStore((state) => state.slippageMode);
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);
  
  // Store latest quote expiration for refresh functionality
  const quoteExpiresAtRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const amountNum = parseNumber(fromAmount);

    // Define clear invariants for valid quote input
    // Route is valid ONLY when all of these are true:
    const isValidQuoteInput =
      amountNum > 0 &&
      fromToken !== null &&
      toToken !== null &&
      activeTab === "swap";

    // Explicitly clear route when invariants break
    console.log("🚀 ~ useSwapQuote ~ isValidQuoteInput:", isValidQuoteInput)
    if (!isValidQuoteInput) {
      setQuoteLoading(false);
      setToAmount("");
      setRoute(null); // ✅ Explicitly and intentionally clear route
      setQuoteError(null);
      quoteExpiresAtRef.current = null;
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setQuoteLoading(true);
    setToAmount("");
    setQuoteError(null);
    // Don't clear route here - it will be updated after API call succeeds
    // Only clear route when explicitly resetting (amount zero, tokens change, etc.)

    const handle = setTimeout(async () => {
      try {
        // Calculate liquidityUSD from token data
        // Use minimum of fromToken and toToken liquidity (conservative approach)
        // If only one has liquidity, use that; if neither has it, don't pass it (backend will fetch)
        let liquidityUSD: number | undefined = undefined;
        if (fromToken.liquidity !== undefined && toToken.liquidity !== undefined) {
          // Use minimum liquidity (more conservative, ensures route works for both tokens)
          liquidityUSD = Math.min(fromToken.liquidity, toToken.liquidity);
        } else if (fromToken.liquidity !== undefined) {
          // Use fromToken liquidity as proxy
          liquidityUSD = fromToken.liquidity;
        } else if (toToken.liquidity !== undefined) {
          // Use toToken liquidity as proxy
          liquidityUSD = toToken.liquidity;
        }
        // If neither has liquidity, liquidityUSD remains undefined (backend will fetch)

        // Fetch route from API
        // Type assertion: chainId is guaranteed to be number at this point due to validation above
        // Decimals are required and come from token data (enriched by TokenService from blockchain)
        const routeResponse = await fetchRoute({
          fromToken: {
            chainId: fromToken.chainId as number,
            address: fromToken.address,
            symbol: fromToken.symbol,
            decimals: fromToken.decimals, // Required: from token data
          },
          toToken: {
            chainId: toToken.chainId as number,
            address: toToken.address,
            symbol: toToken.symbol,
            decimals: toToken.decimals, // Required: from token data
          },
          fromAmount: fromAmount,
          slippage: slippageMode === 'fixed' ? slippageTolerance : undefined, // Use user's fixed slippage or let backend handle auto
          slippageMode: slippageMode,
          order: 'RECOMMENDED', // Default order (can be made configurable)
          liquidityUSD, // Pass liquidity from token data (if available)
        });

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        // Check for error in response (API returns error field even on 200 status)
        if (routeResponse.error) {
          console.error('[useSwapQuote] Route API error:', routeResponse.error);
          setToAmount("");
          setRoute(null); // ✅ Clear route on error
          setQuoteLoading(false);
          setQuoteError(new Error(routeResponse.error));
          quoteExpiresAtRef.current = null;
          return;
        }

        // Validate route response before storing
        // Check if route exists and has required fields (router, fromToken, toToken)
        if (!routeResponse.route || 
            !routeResponse.route.router || 
            !routeResponse.route.fromToken || 
            !routeResponse.route.toToken ||
            !routeResponse.route.toToken.amount) {
          console.error('[useSwapQuote] Invalid route response:', {
            hasRoute: !!routeResponse.route,
            router: routeResponse.route?.router,
            hasFromToken: !!routeResponse.route?.fromToken,
            hasToToken: !!routeResponse.route?.toToken,
            toTokenAmount: routeResponse.route?.toToken?.amount,
            fullResponse: routeResponse,
          });
          setToAmount("");
          setRoute(null); // ✅ Clear route on invalid response
          setQuoteLoading(false);
          setQuoteError(new Error('Invalid route response from server'));
          quoteExpiresAtRef.current = null;
          return;
        }

        // Extract output amount from route
        const outputAmount = routeResponse.route.toToken.amount;
        const formattedOutput = formatToSixDecimals(outputAmount);
        
        // Store expiration timestamp for refresh functionality
        quoteExpiresAtRef.current = routeResponse.expiresAt;

        // Update store with quote result and full route
        setToAmount(formattedOutput);
        setRoute(routeResponse.route); // Store full route response (includes USD values, fees, etc.)
        
        setQuoteLoading(false);
        setQuoteError(null);
        
        // Debug logging (use getState() for accurate current state)
        const storedRoute = useSwapStore.getState().route;
        console.log('[useSwapQuote] Route stored successfully:', {
          router: routeResponse.route.router,
          routeId: routeResponse.route.routeId,
          stepsCount: routeResponse.route.steps?.length,
          hasFees: !!routeResponse.route.fees,
          storedRouteExists: !!storedRoute,
        });
      } catch (error: any) {
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        // Handle error
        console.error('[useSwapQuote] Error fetching quote:', error);
        setToAmount("");
        setRoute(null); // ✅ Clear route on error
        setQuoteLoading(false);
        setQuoteError(error instanceof Error ? error : new Error(error?.message || 'Failed to fetch quote'));
        quoteExpiresAtRef.current = null;
      }
    }, delay);

    return () => {
      clearTimeout(handle);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fromAmount, activeTab, fromToken, toToken, delay, setToAmount, setQuoteLoading, setQuoteError, setRoute, slippageMode, slippageTolerance]);
}


/**
 * Refresh quote manually
 * Useful for quote refresh button
 */
export function useRefreshQuote() {
  const fromAmount = useSwapStore((state) => state.fromAmount);
  const fromToken = useSwapStore((state) => state.fromToken);
  const toToken = useSwapStore((state) => state.toToken);
  const setToAmount = useSwapStore((state) => state.setToAmount);
  const setQuoteLoading = useSwapStore((state) => state.setQuoteLoading);
  const setQuoteError = useSwapStore((state) => state.setQuoteError);
  const setRoute = useSwapStore((state) => state.setRoute);
  
  // Get user slippage settings
  const slippageMode = useSettingsStore((state) => state.slippageMode);
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);

  return async () => {
    if (!fromAmount || !fromToken || !toToken || !fromToken.chainId || !toToken.chainId) {
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);
    setRoute(null);

    try {
      const routeResponse = await fetchRoute({
        fromToken: {
          chainId: fromToken.chainId,
          address: fromToken.address,
          symbol: fromToken.symbol,
        },
        toToken: {
          chainId: toToken.chainId,
          address: toToken.address,
          symbol: toToken.symbol,
        },
        fromAmount: fromAmount,
        slippage: slippageMode === 'fixed' ? slippageTolerance : undefined,
        slippageMode: slippageMode,
        order: 'RECOMMENDED',
      });

      // Validate route response before storing
      if (!routeResponse.route || !routeResponse.route.router || !routeResponse.route.fromToken) {
        console.error('[useRefreshQuote] Invalid route response:', routeResponse);
        setRoute(null);
        setQuoteLoading(false);
        setQuoteError(new Error('Invalid route response from server'));
        return;
      }

      setToAmount(formatToSixDecimals(routeResponse.route.toToken.amount));
      setRoute(routeResponse.route); // Store full route response
      setQuoteLoading(false);
      setQuoteError(null);
      
      console.log('[useRefreshQuote] Route refreshed successfully:', {
        router: routeResponse.route.router,
        routeId: routeResponse.route.routeId,
      });
    } catch (error: any) {
      console.error('[useRefreshQuote] Error refreshing quote:', error);
      setRoute(null);
      setQuoteLoading(false);
      setQuoteError(error instanceof Error ? error : new Error(error?.message || 'Failed to refresh quote'));
    }
  };
}

/**
 * Format output amount to 6 decimal places for display.
 * If parsing fails, return original string.
 */
function formatToSixDecimals(value: string): string {
  const num = Number(value);
  if (!isFinite(num)) {
    return value;
  }
  return num.toFixed(6);
}


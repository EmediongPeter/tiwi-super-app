/**
 * Historical OHLC Data API Route
 * 
 * Returns historical OHLC bars for TradingView chart.
 * Implements UDF (Unified Data Feed) protocol.
 * 
 * Query params:
 * - symbol: Symbol identifier (format: baseAddress-quoteAddress-chainId)
 * - resolution: Time resolution ("1", "5", "15", "30", "60", "1D", "1W", "1M")
 * - from: Start timestamp (Unix seconds)
 * - to: End timestamp (Unix seconds)
 * - countback?: Optional number of bars to fetch
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChartDataService } from '@/lib/backend/services/chart-data-service';
import type { ResolutionString } from '@/lib/backend/types/chart';

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const resolution = searchParams.get('resolution') as ResolutionString;
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const countbackStr = searchParams.get('countback');

    // Validate required parameters
    if (!symbol) {
      return NextResponse.json(
        { s: 'error', errmsg: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    if (!resolution) {
      return NextResponse.json(
        { s: 'error', errmsg: 'Resolution parameter is required' },
        { status: 400 }
      );
    }

    if (!fromStr || !toStr) {
      return NextResponse.json(
        { s: 'error', errmsg: 'From and to parameters are required' },
        { status: 400 }
      );
    }

    // Parse timestamps
    const from = parseInt(fromStr, 10);
    const to = parseInt(toStr, 10);
    const countback = countbackStr ? parseInt(countbackStr, 10) : undefined;

    if (isNaN(from) || isNaN(to)) {
      return NextResponse.json(
        { s: 'error', errmsg: 'Invalid timestamp format' },
        { status: 400 }
      );
    }

    // Parse symbol to get base, quote, chainId
    const parts = symbol.split('-');
    if (parts.length !== 3) {
      return NextResponse.json(
        { s: 'error', errmsg: 'Invalid symbol format. Expected: baseAddress-quoteAddress-chainId' },
        { status: 400 }
      );
    }

    const [baseToken, quoteToken, chainIdStr] = parts;
    const chainId = parseInt(chainIdStr, 10);

    if (isNaN(chainId)) {
      return NextResponse.json(
        { s: 'error', errmsg: 'Invalid chain ID in symbol' },
        { status: 400 }
      );
    }

    // Fetch historical bars
    const chartService = getChartDataService();
    const bars = await chartService.getHistoricalBars({
      baseToken,
      quoteToken,
      chainId,
      resolution,
      from,
      to,
      countback,
    });

    // Transform to UDF format
    if (bars.length === 0) {
      return NextResponse.json({
        s: 'no_data',
      });
    }

    // UDF format: arrays of values
    const response = {
      s: 'ok' as const,
      t: bars.map(bar => Math.floor(bar.time / 1000)), // Convert to seconds
      o: bars.map(bar => bar.open),
      h: bars.map(bar => bar.high),
      l: bars.map(bar => bar.low),
      c: bars.map(bar => bar.close),
      v: bars.map(bar => bar.volume || 0),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] /api/v1/charts/history GET error:', error);
    
    // Return UDF error format
    return NextResponse.json(
      { s: 'error', errmsg: error?.message || 'Failed to fetch historical data' },
      { status: 500 }
    );
  }
}


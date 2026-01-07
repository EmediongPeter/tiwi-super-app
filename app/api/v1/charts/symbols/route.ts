/**
 * Symbol Resolution API Route
 * 
 * Resolves symbol information for TradingView.
 * Implements UDF (Unified Data Feed) protocol.
 * 
 * Query params:
 * - symbol: Symbol identifier (format: baseAddress-quoteAddress-chainId)
 * - currencyCode?: Optional currency code
 * - unitId?: Optional unit ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChartDataService } from '@/lib/backend/services/chart-data-service';

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { s: 'error', errmsg: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    const chartService = getChartDataService();
    const symbolInfo = await chartService.resolveSymbol(symbol);

    // Return in UDF format
    return NextResponse.json(symbolInfo);
  } catch (error: any) {
    console.error('[API] /api/v1/charts/symbols GET error:', error);
    
    // Return UDF error format
    return NextResponse.json(
      { s: 'error', errmsg: error?.message || 'Failed to resolve symbol' },
      { status: 400 }
    );
  }
}


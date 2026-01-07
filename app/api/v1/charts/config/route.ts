/**
 * Chart Configuration API Route
 * 
 * Returns TradingView chart configuration.
 * Implements UDF (Unified Data Feed) protocol.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChartDataService } from '@/lib/backend/services/chart-data-service';

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const chartService = getChartDataService();
    const config = chartService.getConfiguration();

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('[API] /api/v1/charts/config GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch chart configuration' },
      { status: 500 }
    );
  }
}


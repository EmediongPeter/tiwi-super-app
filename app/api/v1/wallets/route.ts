/**
 * User Wallets API Route
 *
 * Endpoint: POST /api/v1/wallets
 *
 * Registers a wallet address with the TIWI platform for analytics & UX:
 * - Stores ONLY public address and source (no private keys, no seed phrases).
 * - Idempotent: re-registering the same address+source is treated as success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, type Database } from '@/lib/backend/utils/supabase';

type UserWalletInsert = Database['public']['Tables']['user_wallets']['Insert'];

// Basic on-chain address validator (EVM + Solana-style)
function validateAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;

  // Ethereum address: 0x followed by 40 hex chars
  if (address.startsWith('0x') && address.length === 42) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // Solana-style: base58, 32-44 chars
  if (address.length >= 32 && address.length <= 44) {
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
  }

  return false;
}

const ALLOWED_SOURCES: UserWalletInsert['source'][] = [
  'local',
  'metamask',
  'walletconnect',
  'coinbase',
  'rabby',
  'phantom',
  'other',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const address: string | undefined = body?.address;
    const source: string | undefined = body?.source;

    if (!address) {
      return NextResponse.json(
        { error: 'Missing required field: address' },
        { status: 400 }
      );
    }

    if (!validateAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const normalizedSource = (source || 'other').toLowerCase() as UserWalletInsert['source'];

    if (!ALLOWED_SOURCES.includes(normalizedSource)) {
      return NextResponse.json(
        { error: 'Invalid source value' },
        { status: 400 }
      );
    }

    const payload: UserWalletInsert = {
      wallet_address: address,
      source: normalizedSource,
    };

    const { error } = await supabase
      .from('user_wallets')
      .insert(payload);

    // If unique constraint is hit, treat as success (idempotent)
    if (error) {
      const isUniqueViolation =
        (error as any)?.code === '23505' ||
        (error as any)?.message?.toLowerCase().includes('duplicate key');

      if (!isUniqueViolation) {
        console.error('[API] /api/v1/wallets POST error:', error);
        return NextResponse.json(
          { error: 'Failed to register wallet' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        wallet_address: address,
        source: normalizedSource,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API] /api/v1/wallets POST unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}



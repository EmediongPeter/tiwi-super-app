import { decodeFunctionData } from 'viem';

// From the error logs, this is the transaction data
const txData = '0x38ed1739000000000000000000000000000000000000000000170caf84d534b39c0bb6000000000000000000000000000000000000000000000000001b0bf9b6ac93003f00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000029d75c4d23fe5041e2aa86d06da3e53ddd3c597800000000000000000000000000000000000000000000000000000000692979f3';

const ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

try {
  const decoded = decodeFunctionData({
    abi: ROUTER_ABI,
    data: txData as `0x${string}`,
  });

  console.log('='.repeat(60));
  console.log('DECODED FAILED TRANSACTION');
  console.log('='.repeat(60));
  console.log('');
  console.log('Function:', decoded.functionName);
  console.log('');
  console.log('Parameters:');
  console.log('  Amount In:', decoded.args[0].toString(), `(${(Number(decoded.args[0]) / 1e18).toFixed(6)} tokens)`);
  console.log('  Amount Out Min:', decoded.args[1].toString(), `(${(Number(decoded.args[1]) / 1e18).toFixed(6)} tokens)`);
  console.log('  Path:', decoded.args[2].map((addr: string) => addr.slice(0, 6) + '...' + addr.slice(-4)).join(' -> '));
  console.log('  To:', decoded.args[3]);
  console.log('  Deadline:', decoded.args[4].toString());
  console.log('');
  console.log('='.repeat(60));
  console.log('ANALYSIS');
  console.log('='.repeat(60));
  console.log('');
  console.log('The transaction failed because:');
  console.log('  - Amount Out Min was set to:', (Number(decoded.args[1]) / 1e18).toFixed(6), 'tokens');
  console.log('  - The actual output from the swap was LESS than this minimum');
  console.log('  - This causes the swap to revert');
  console.log('');
  console.log('The amountOutMin is too high relative to what the swap can actually achieve.');
  console.log('This could be due to:');
  console.log('  1. Price moved between quote and execution');
  console.log('  2. Multi-hop rounding errors accumulated');
  console.log('  3. Insufficient liquidity in intermediate pairs');
  console.log('');
  console.log('Current fix uses 50% slippage, but we may need to go even lower.');
} catch (error: any) {
  console.error('Error decoding:', error.message);
}

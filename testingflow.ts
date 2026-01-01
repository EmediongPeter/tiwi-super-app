/**
 * Test script to fetch token decimals using viem
 * Testing with TIWI CAT (TWC) token on BNB Chain
 */

import { createPublicClient, http, type Address } from 'viem';
import { bsc } from 'viem/chains';

// TWC Token address on BNB Chain
const TWC_ADDRESS = '0xAC0FbE32C7f6b7bE3E9822787F1B4D2864b74444' as Address;

// ERC-20 decimals() function ABI
const ERC20_DECIMALS_ABI = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function testFetchDecimals() {
  try {
    console.log('🔍 Testing viem method to fetch token decimals...');
    console.log('Token Address:', TWC_ADDRESS);
    console.log('Chain: BNB Chain (56)');
    
    // Create public client for BNB Chain
    const publicClient = createPublicClient({
      chain: bsc,
      transport: http(),
    });
    
    console.log('\n📡 Calling decimals() function on contract...');
    
    // Call decimals() function on the ERC-20 contract
    const decimals = await publicClient.readContract({
      address: TWC_ADDRESS,
      abi: ERC20_DECIMALS_ABI,
      functionName: 'decimals',
    });
    
    const decimalsNumber = Number(decimals);
    
    console.log('✅ Success!');
    console.log('Raw response:', decimals);
    console.log('Decimals:', decimalsNumber);
    console.log('\n📊 Result:');
    console.log(`TWC token has ${decimalsNumber} decimals`);
    
    // Test with a sample amount conversion
    if (decimalsNumber > 0) {
      const sampleAmount = '21192370965782895321475'; // Example raw amount
      const humanReadable = (BigInt(sampleAmount) / BigInt(10 ** decimalsNumber)).toString();
      console.log(`\n🧮 Sample conversion test:`);
      console.log(`Raw amount: ${sampleAmount}`);
      console.log(`Human-readable (with ${decimalsNumber} decimals): ${humanReadable}`);
    }
    
    return decimalsNumber;
  } catch (error: any) {
    console.error('❌ Error fetching decimals:', error);
    console.error('Error message:', error?.message);
    console.error('Error details:', error);
    throw error;
  }
}

// Run the test
testFetchDecimals()
  .then((decimals) => {
    console.log('\n✅ Test completed successfully!');
    console.log(`Final result: ${decimals} decimals`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed!');
    process.exit(1);
  });
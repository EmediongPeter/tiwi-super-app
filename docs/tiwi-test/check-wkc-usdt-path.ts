// Script to check WKC to USDT swap path on PancakeSwap (BSC)
import { createPublicClient, http, getAddress, type Address } from 'viem';
import { bsc } from 'viem/chains';
import { 
  getPancakeSwapV2Quote,
  getPairAddress,
  WETH_ADDRESSES,
  type PancakeSwapV2Quote
} from './app/utils/pancakeswapv2';

// Known token addresses on BSC
const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955' as Address;
const WKC_BSC = '0x6Ec90334d89dbdc89e08a133271be3d104128Edb' as Address; // From error logs
const CHAIN_ID = 56; // BSC

async function checkSwapPath() {
  console.log('='.repeat(60));
  console.log('Checking WKC -> USDT swap path on PancakeSwap (BSC)');
  console.log('='.repeat(60));
  console.log('');
  console.log('Token Addresses:');
  console.log('  WKC:', WKC_BSC);
  console.log('  USDT:', USDT_BSC);
  console.log('  WBNB:', WETH_ADDRESSES[CHAIN_ID]);
  console.log('');

  const publicClient = createPublicClient({
    chain: bsc,
    transport: http('https://bsc-dataseed1.binance.org'),
  });

  // Check direct pair WKC-USDT
  console.log('1. Checking direct pair: WKC <-> USDT');
  const directPair = await getPairAddress(WKC_BSC, USDT_BSC, CHAIN_ID);
  if (directPair) {
    console.log('   ✓ Direct pair EXISTS:', directPair);
  } else {
    console.log('   ✗ Direct pair does NOT exist');
  }
  console.log('');

  // Check WKC-WBNB pair
  console.log('2. Checking pair: WKC <-> WBNB');
  const wkcWbnbPair = await getPairAddress(WKC_BSC, WETH_ADDRESSES[CHAIN_ID], CHAIN_ID);
  if (wkcWbnbPair) {
    console.log('   ✓ WKC-WBNB pair EXISTS:', wkcWbnbPair);
  } else {
    console.log('   ✗ WKC-WBNB pair does NOT exist');
  }
  console.log('');

  // Check WBNB-USDT pair
  console.log('3. Checking pair: WBNB <-> USDT');
  const wbnbUsdtPair = await getPairAddress(WETH_ADDRESSES[CHAIN_ID], USDT_BSC, CHAIN_ID);
  if (wbnbUsdtPair) {
    console.log('   ✓ WBNB-USDT pair EXISTS:', wbnbUsdtPair);
  } else {
    console.log('   ✗ WBNB-USDT pair does NOT exist');
  }
  console.log('');

  // Get quote using our utility function
  console.log('4. Getting quote from PancakeSwap router...');
  const testAmount = '1000000000000000000'; // 1 token (18 decimals)
  
  try {
    const quote = await getPancakeSwapV2Quote(
      WKC_BSC,
      USDT_BSC,
      testAmount,
      CHAIN_ID
    );

    if (quote) {
      console.log('   ✓ Quote obtained successfully!');
      console.log('');
      console.log('Quote Details:');
      console.log('  Path:', quote.path.map(addr => `${addr.slice(0, 6)}...${addr.slice(-4)}`).join(' -> '));
      console.log('  Path Length:', quote.path.length, quote.path.length > 2 ? '(Multi-hop)' : '(Direct)');
      console.log('  Input: 1 WKC');
      console.log('  Output:', (parseFloat(quote.amountOut) / 1e18).toFixed(6), 'USDT');
      console.log('  Router:', quote.routerAddress);
      console.log('  Factory:', quote.factoryAddress);
      
      if (quote.needsPairCreation) {
        console.log('  ⚠ Needs pair creation:', quote.missingPairs?.map(p => 
          `${p.tokenA.slice(0, 6)}...${p.tokenA.slice(-4)} <-> ${p.tokenB.slice(0, 6)}...${p.tokenB.slice(-4)}`
        ).join(', '));
      } else {
        console.log('  ✓ All pairs exist');
      }
    } else {
      console.log('   ✗ Could not get quote');
    }
  } catch (error: any) {
    console.log('   ✗ Error getting quote:', error.message);
    if (error.message.includes('Pancake: K')) {
      console.log('   ⚠ "Pancake: K" error detected - path exists but swap calculation fails');
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log('='.repeat(60));
  console.log('The swap path will be determined by which pairs exist:');
  console.log('- If WKC-USDT pair exists: Direct swap (WKC -> USDT)');
  console.log('- If WKC-WBNB and WBNB-USDT exist: Multi-hop (WKC -> WBNB -> USDT)');
  console.log('- If pairs are missing: Swap will fail or require pair creation');
}

checkSwapPath().catch(console.error);



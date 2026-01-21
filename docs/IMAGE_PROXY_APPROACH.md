# Image Proxying Approach

## Problem

Token and chain logos come from various external domains:
- `storage.googleapis.com` (Zapper)
- `coin-images.coingecko.com` (CoinGecko)
- `cdn.dexscreener.com` (DexScreener)
- `raw.githubusercontent.com` (GitHub)

**Issues:**
1. Next.js requires explicit domain configuration for each external image domain
2. CORS issues may occur
3. No control over image availability
4. Hard to cache or optimize images

## Solution: Backend Image Proxy

### Approach 1: Proxy Endpoint (Recommended)

Create a backend API endpoint that proxies images through your domain:

**Backend Endpoint:**
```
GET /api/v1/images/proxy?url={encoded_image_url}
```

**Example:**
```
GET /api/v1/images/proxy?url=https%3A%2F%2Fstorage.googleapis.com%2Fzapper-fi-assets%2Ftokens%2Foptimism%2F0x76fb31fb4af56892a25e32cfc43de717950c9278.png
```

**Backend Implementation (Next.js API Route):**

```typescript
// app/api/v1/images/proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const imageUrl = searchParams.get('url');
  
  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }
  
  try {
    // Fetch image from external source
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status });
    }
    
    // Get image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    
    // Return image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('[ImageProxy] Error fetching image:', error);
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 500 });
  }
}
```

**Frontend Usage:**

```typescript
// lib/api/tokens.ts
function transformToken(backendToken: NormalizedToken): Token {
  const id = `${backendToken.chainId}-${backendToken.address.toLowerCase()}`;
  
  // Proxy image URL through backend
  const logoUrl = backendToken.logoURI
    ? `/api/v1/images/proxy?url=${encodeURIComponent(backendToken.logoURI)}`
    : '';
  
  return {
    id,
    name: backendToken.name,
    symbol: backendToken.symbol,
    address: backendToken.address,
    logo: logoUrl,
    // ...
  };
}
```

**Benefits:**
- ✅ Single domain for all images (your backend)
- ✅ No Next.js image domain configuration needed
- ✅ CORS issues handled on backend
- ✅ Can add caching, optimization, fallbacks
- ✅ Can add image transformation (resize, format conversion)

**Drawbacks:**
- ⚠️ Additional backend load
- ⚠️ Slightly slower (extra hop)

---

### Approach 2: Direct URLs (Current)

Keep using direct image URLs but configure Next.js domains.

**Pros:**
- ✅ Faster (direct fetch)
- ✅ No backend load

**Cons:**
- ⚠️ Must configure each domain in `next.config.ts`
- ⚠️ CORS issues possible
- ⚠️ No control over image availability

---

## Recommendation

**For Now:** Use Approach 2 (direct URLs) with proper Next.js configuration.

**For Future:** Consider Approach 1 (proxy) if you need:
- Image optimization
- Consistent caching
- Fallback images
- Image transformation

---

## Implementation Status

**Current:** Using direct URLs with Next.js domain configuration.

**Next Steps (if implementing proxy):**
1. Create `/api/v1/images/proxy` endpoint
2. Update `transformToken()` to use proxy URLs
3. Update `transformChain()` to use proxy URLs
4. Remove external domains from `next.config.ts` (optional)


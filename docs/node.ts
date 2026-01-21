async function fetchSquidChains(){
    try {
      const response = await fetch('https://v2.api.squidrouter.com/v2/chains', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-integrator-id': 'tiwi-protocol-c69a0e79-2f7c-4e65-8ee7-077f7f7ed835'
        },
      });
      
      console.log("🚀 ~ fetchSquidChains ~ response:", await response.json())
      return response
    } catch (err: any) {
      console.warn('[Squid Chains] Error fetching chains from API route:', err.message);
      console.log(err)
    }
  } 
  fetchSquidChains();
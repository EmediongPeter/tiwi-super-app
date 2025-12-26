/**
 * Error Message Utilities
 * 
 * Provides user-friendly error messages and next steps for routing errors.
 */

export interface RouteErrorInfo {
  title: string;
  message: string;
  nextSteps?: string[];
}

/**
 * Parse routing error and return short, user-friendly message
 */
export function parseRouteError(error: Error | string): RouteErrorInfo {
  const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
  const lowerMessage = errorMessage.toLowerCase();

  // No route found errors
  if (lowerMessage.includes('no route found') || lowerMessage.includes('no route available')) {
    return {
      title: 'Route not available',
      message: 'No swap route for this pair.',
    };
  }

  // No routers support this chain
  if (lowerMessage.includes('no routers support') || lowerMessage.includes('chain combination')) {
    return {
      title: 'Chain not supported',
      message: 'This network combo is not supported.',
    };
  }

  // Insufficient liquidity
  if (lowerMessage.includes('insufficient liquidity') || lowerMessage.includes('low liquidity')) {
    return {
      title: 'Low liquidity',
      message: 'Not enough liquidity for this swap.',
    };
  }

  // Timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return {
      title: 'Timed out',
      message: 'Request took too long. Please retry.',
    };
  }

  // Invalid parameters
  if (lowerMessage.includes('invalid') || lowerMessage.includes('missing required')) {
    return {
      title: 'Invalid input',
      message: 'Check tokens and amount, then retry.',
    };
  }

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('fetch')) {
    return {
      title: 'Network issue',
      message: 'Check your connection and retry.',
    };
  }

  // Generic error
  return {
    title: 'Swap failed',
    message: 'Something went wrong. Please retry.',
  };
}

/**
 * Extract router names from error message
 */
export function extractRouterNames(errorMessage: string): string[] {
  const routerMap: Record<string, string> = {
    'lifi': 'LiFi',
    'pancakeswap': 'PancakeSwap',
    'uniswap': 'Uniswap',
    'squid': 'Squid',
    'jupiter': 'Jupiter',
    'relay': 'Relay',
  };

  const routers: string[] = [];
  const lowerMessage = errorMessage.toLowerCase();

  for (const [key, displayName] of Object.entries(routerMap)) {
    if (lowerMessage.includes(key)) {
      routers.push(displayName);
    }
  }

  return routers;
}

/**
 * Format error message for display (truncate long messages)
 */
export function formatErrorMessage(error: Error | string, maxLength: number = 200): string {
  const message = typeof error === 'string' ? error : error.message || 'Unknown error';
  
  if (message.length <= maxLength) {
    return message;
  }

  // Truncate and add ellipsis
  return message.substring(0, maxLength - 3) + '...';
}


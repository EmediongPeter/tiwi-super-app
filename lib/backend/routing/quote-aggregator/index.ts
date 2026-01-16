/**
 * Quote Aggregator Module
 * 
 * Exports for the quote aggregator module.
 */

export { QuoteAggregator, getQuoteAggregator } from './quote-aggregator';
export { RouteValidator, getRouteValidator } from './route-validator';

export type {
  QuoteSource,
  AggregatedQuote,
  QuoteAggregationOptions,
  ValidationResult,
} from './quote-aggregator';


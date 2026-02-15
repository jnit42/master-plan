import { CostRange } from "@/types/mastercontractor";

export type PricePosition = "LOW" | "FAIR" | "HIGH" | "EXTREME_HIGH";

export interface SubBidBenchmark {
  position: PricePosition;
  varianceFromLikelyPercent: number;
  suggestedLow: number;
  suggestedLikely: number;
  suggestedHigh: number;
  message: string;
}

export interface RetailStrategy {
  overheadPercent: number;
  profitPercent: number;
  contingencyPercent: number;
}

export interface RetailRecommendation {
  floor: number;
  target: number;
  stretch: number;
  totalMarkupPercentOnHardCost: number;
}

/**
 * Compare a subcontractor bid to a market range.
 */
export function benchmarkSubBid(subBidAmount: number, marketRange: CostRange): SubBidBenchmark {
  const likely = Math.max(marketRange.likely, 1);
  const variance = ((subBidAmount - likely) / likely) * 100;

  const position: PricePosition =
    subBidAmount <= marketRange.low
      ? "LOW"
      : subBidAmount <= marketRange.high
        ? "FAIR"
        : variance <= 15
          ? "HIGH"
          : "EXTREME_HIGH";

  let message = "Within expected market range.";
  if (position === "LOW") {
    message = "Bid is below expected range. Verify scope completeness and exclusions.";
  }
  if (position === "HIGH") {
    message = "Bid is above market range. Negotiate and compare alternates.";
  }
  if (position === "EXTREME_HIGH") {
    message = "Bid is significantly above market. Require itemized backup or rebid.";
  }

  return {
    position,
    varianceFromLikelyPercent: Number(variance.toFixed(2)),
    suggestedLow: marketRange.low,
    suggestedLikely: marketRange.likely,
    suggestedHigh: marketRange.high,
    message,
  };
}

/**
 * Recommend client-facing retail pricing from hard costs.
 */
export function recommendRetailPrice(
  hardCost: number,
  strategy: RetailStrategy,
): RetailRecommendation {
  const baseMultiplier = 1 + (strategy.overheadPercent + strategy.profitPercent) / 100;
  const contingencyMultiplier = 1 + strategy.contingencyPercent / 100;

  const floor = hardCost * baseMultiplier;
  const target = floor * (1 + strategy.contingencyPercent / 200);
  const stretch = floor * contingencyMultiplier;

  const markupPercent = ((target - hardCost) / Math.max(hardCost, 1)) * 100;

  return {
    floor: roundMoney(floor),
    target: roundMoney(target),
    stretch: roundMoney(stretch),
    totalMarkupPercentOnHardCost: Number(markupPercent.toFixed(2)),
  };
}

/**
 * Incremental learning helper (EMA) so each new actual updates expected rate.
 */
export function updateExpectedUnitRate(currentRate: number, observedRate: number, alpha = 0.25): number {
  const clampedAlpha = Math.max(0.05, Math.min(alpha, 0.6));
  return roundMoney(currentRate + clampedAlpha * (observedRate - currentRate));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

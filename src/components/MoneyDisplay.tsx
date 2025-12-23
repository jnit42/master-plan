import { cn } from '@/lib/utils';
import { formatCurrency, formatCostRange } from '@/lib/engine/summary';

interface MoneyDisplayProps {
  amount: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl font-bold',
};

export function MoneyDisplay({ amount, className, size = 'md' }: MoneyDisplayProps) {
  return (
    <span className={cn('money', sizeClasses[size], className)}>
      {formatCurrency(amount)}
    </span>
  );
}

interface MoneyRangeProps {
  low: number;
  mid: number;
  high: number;
  className?: string;
  showMid?: boolean;
}

export function MoneyRange({ low, mid, high, className, showMid = true }: MoneyRangeProps) {
  if (low === 0 && high === 0) {
    return <span className={cn('text-muted-foreground', className)}>No estimate</span>;
  }

  return (
    <div className={cn('space-y-1', className)}>
      {showMid && (
        <div className="money text-lg font-semibold">
          {formatCurrency(mid)}
        </div>
      )}
      <div className="money text-sm text-muted-foreground">
        {formatCostRange(low, mid, high)}
      </div>
    </div>
  );
}

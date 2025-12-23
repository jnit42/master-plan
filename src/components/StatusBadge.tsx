import { cn } from '@/lib/utils';
import { QuoteStatus, ConfidenceLevel } from '@/types/mastercontractor';

interface StatusBadgeProps {
  status: QuoteStatus;
  className?: string;
}

const statusConfig: Record<QuoteStatus, { label: string; className: string }> = {
  VERIFIED: { label: 'Verified', className: 'status-verified' },
  PENDING: { label: 'Pending', className: 'status-pending' },
  POTENTIAL_DUPLICATE: { label: 'Potential Dup', className: 'status-duplicate' },
  DECISION_REQUIRED: { label: 'Decision Req', className: 'status-decision' },
  ESTIMATE: { label: 'Estimate', className: 'status-estimate' },
  GAP: { label: 'Gap', className: 'status-gap' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  className?: string;
}

const confidenceConfig: Record<ConfidenceLevel, { label: string; className: string }> = {
  HIGH: { label: 'High', className: 'confidence-high' },
  MEDIUM: { label: 'Medium', className: 'confidence-medium' },
  LOW: { label: 'Low', className: 'confidence-low' },
};

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const config = confidenceConfig[confidence];
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium',
        config.className,
        className
      )}
    >
      <span className={cn('w-2 h-2 rounded-full', `bg-confidence-${confidence.toLowerCase()}`)} />
      {config.label} Confidence
    </span>
  );
}

import { useEffect, useState } from 'react';
import { AlertTriangle, CircleCheck, CircleX, Loader2 } from 'lucide-react';
import type { Network } from '../contexts/NetworkContext';
import type { Piece } from './types';
import {
  checkDatasetHealth,
  type DatasetHealthLevel,
} from '../utils/datasetHealth';
import { cn } from './ui/utils';

type HealthUiState =
  | { phase: 'loading'; checked: number; total: number }
  | { phase: 'ready'; status: DatasetHealthLevel; atRiskCount: number; missingCount: number }
  | { phase: 'error'; message: string }
  | { phase: 'idle' };

const HEALTH_LABEL: Record<DatasetHealthLevel, string> = {
  green: 'Healthy',
  amber: 'At risk',
  red: 'Unhealthy',
};

const HEALTH_ICON_CLASS: Record<DatasetHealthLevel, string> = {
  green: 'text-emerald-600',
  amber: 'text-amber-500',
  red: 'text-red-600',
};

function HealthIcon({ status }: { status: DatasetHealthLevel }) {
  const className = cn('h-5 w-5 shrink-0', HEALTH_ICON_CLASS[status]);
  switch (status) {
    case 'green':
      return <CircleCheck className={className} aria-hidden />;
    case 'amber':
      return <AlertTriangle className={className} aria-hidden />;
    case 'red':
      return <CircleX className={className} aria-hidden />;
  }
}

export function DatasetHealthIndicator({
  pieces,
  network,
}: {
  pieces?: Piece[];
  network: Network;
}) {
  const [state, setState] = useState<HealthUiState>({ phase: 'idle' });

  useEffect(() => {
    if (!pieces?.length) {
      setState({ phase: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ phase: 'loading', checked: 0, total: Math.min(pieces.length, 5) });

    checkDatasetHealth(pieces, network, (checked, total) => {
      if (!cancelled) {
        setState({ phase: 'loading', checked, total });
      }
    })
      .then((result) => {
        if (cancelled) return;
        setState({
          phase: 'ready',
          status: result.status,
          atRiskCount: result.atRiskCount,
          missingCount: result.missingCount,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Health check failed';
        setState({ phase: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [pieces, network]);

  if (state.phase === 'idle') {
    return null;
  }

  return (
    <div
      className="rounded-md border border-border bg-muted/40 p-3 space-y-2"
      aria-live="polite"
      aria-busy={state.phase === 'loading'}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {state.phase === 'loading' && (
          <>
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            <span>
              Checking storage health
              {state.total > 0
                ? ` (${Math.min(state.checked + 1, state.total)} of ${state.total} Pieces)`
                : '…'}
            </span>
          </>
        )}
        {state.phase === 'ready' && (
          <>
            <HealthIcon status={state.status} />
            <span>
              Dataset health:{' '}
              <span className={HEALTH_ICON_CLASS[state.status]}>{HEALTH_LABEL[state.status]}</span>
            </span>
          </>
        )}
        {state.phase === 'error' && (
          <>
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
            <span className="text-muted-foreground">Could not verify health ({state.message})</span>
          </>
        )}
      </div>

      {state.phase === 'ready' && state.status === 'amber' && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          At least {state.atRiskCount} Piece{state.atRiskCount === 1 ? '' : 's'} at risk (only one
          storage provider).
        </p>
      )}
      {state.phase === 'ready' && state.status === 'red' && (
        <p className="text-sm text-red-700 dark:text-red-400">
          At least {state.missingCount} Piece{state.missingCount === 1 ? '' : 's'} missing storage
          providers.
          {state.atRiskCount > 0 &&
            ` ${state.atRiskCount} additional Piece${state.atRiskCount === 1 ? '' : 's'} at risk.`}
        </p>
      )}
    </div>
  );
}

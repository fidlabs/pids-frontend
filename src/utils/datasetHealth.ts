import type { Network } from '../contexts/NetworkContext';
import type { Piece } from '../components/types';

export type PieceHealthLevel = 'green' | 'amber' | 'red';

export type PieceHealthResult = {
  pieceCid: string;
  providerCount: number;
  status: PieceHealthLevel;
};

export type DatasetHealthLevel = PieceHealthLevel;

const FILECOIN_TOOLS_API: Record<Network, string> = {
  mainnet: 'https://api.filecoin.tools/api',
  calibration: 'https://api.tools.calibration.interplanetary.one/api',
};

const HEALTH_SAMPLE_SIZE = 5;

type FilecoinToolsSearchDeal = {
  providerId?: string | number;
  pieceCid?: string;
};

type FilecoinToolsSearchResponse = {
  data?: FilecoinToolsSearchDeal[];
};

/** Pick up to 5 pieces; use all when the dataset has 5 or fewer. */
export function samplePiecesForHealth(pieces: Piece[]): Piece[] {
  if (pieces.length <= HEALTH_SAMPLE_SIZE) {
    return [...pieces];
  }
  const copy = [...pieces];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, HEALTH_SAMPLE_SIZE);
}

export function pieceHealthFromProviderCount(providerCount: number): PieceHealthLevel {
  if (providerCount <= 0) return 'red';
  if (providerCount === 1) return 'amber';
  return 'green';
}

export function aggregateDatasetHealth(results: PieceHealthResult[]): {
  status: DatasetHealthLevel;
  atRiskCount: number;
  missingCount: number;
} {
  let atRiskCount = 0;
  let missingCount = 0;
  for (const result of results) {
    if (result.status === 'red') missingCount += 1;
    if (result.status === 'amber') atRiskCount += 1;
  }
  let status: DatasetHealthLevel = 'green';
  if (missingCount > 0) status = 'red';
  else if (atRiskCount > 0) status = 'amber';
  return { status, atRiskCount, missingCount };
}

/** Unique storage providers storing / proving a piece (filecoin.tools search). */
export async function countProvidersForPiece(
  pieceCid: string,
  network: Network,
): Promise<number> {
  const baseUrl = FILECOIN_TOOLS_API[network];
  const providers = new Set<string>();
  let page = 1;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${baseUrl}/search`);
    url.searchParams.set('filter', pieceCid);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`filecoin.tools search failed (${response.status})`);
    }

    const body = (await response.json()) as FilecoinToolsSearchResponse;
    const deals = body.data ?? [];
    if (deals.length === 0) {
      hasMore = false;
      continue;
    }

    for (const deal of deals) {
      if (deal.providerId != null && deal.providerId !== '') {
        providers.add(String(deal.providerId));
      }
    }

    hasMore = deals.length >= limit;
    page += 1;
  }

  return providers.size;
}

export async function checkDatasetHealth(
  pieces: Piece[],
  network: Network,
  onProgress?: (checked: number, total: number) => void,
): Promise<{
  status: DatasetHealthLevel;
  atRiskCount: number;
  missingCount: number;
  sampled: PieceHealthResult[];
}> {
  const sampledPieces = samplePiecesForHealth(pieces);
  const total = sampledPieces.length;
  const sampled: PieceHealthResult[] = [];

  for (let i = 0; i < sampledPieces.length; i++) {
    onProgress?.(i, total);
    const pieceCid = sampledPieces[i].piece_cid;
    const providerCount = await countProvidersForPiece(pieceCid, network);
    sampled.push({
      pieceCid,
      providerCount,
      status: pieceHealthFromProviderCount(providerCount),
    });
  }

  onProgress?.(total, total);
  const { status, atRiskCount, missingCount } = aggregateDatasetHealth(sampled);
  return { status, atRiskCount, missingCount, sampled };
}

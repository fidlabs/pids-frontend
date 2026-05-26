/**
 * Resolve dataset UUIDs from a Filecoin Piece CID.
 */

const PIECE_CID_PREFIX = 'baga';

export const normalizePieceCid = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const isLikelyPieceCid = (pieceCid) => {
  if (!pieceCid) {
    return false;
  }
  return pieceCid.startsWith(PIECE_CID_PREFIX);
};

export const buildResolveQuery = ({ pieceCid, network, publicOnly }) => {
  const query = {
    isPublic: true,
    'pieces.piece_cid': pieceCid,
  };

  if (publicOnly) {
    query.status = 'approved';
  }

  if (network) {
    query.network = network;
  }

  return query;
};

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

const fileStructureContainsPieceCid = (nodes, pieceCid) => {
  if (!Array.isArray(nodes)) {
    return false;
  }

  for (const node of nodes) {
    if (node?.piece_cid === pieceCid) {
      return true;
    }
    if (fileStructureContainsPieceCid(node?.children, pieceCid)) {
      return true;
    }
  }

  return false;
};

export const datasetContainsPieceCid = (dataset, pieceCid) => {
  if (!dataset || !pieceCid) {
    return false;
  }

  if (Array.isArray(dataset.pieces) && dataset.pieces.some((piece) => piece?.piece_cid === pieceCid)) {
    return true;
  }

  return fileStructureContainsPieceCid(dataset.fileStructure, pieceCid);
};

export const buildResolveQuery = ({ pieceCid, network, publicOnly }) => {
  const query = {
    isPublic: true,
    $or: [
      { 'pieces.piece_cid': pieceCid },
      { 'fileStructure.piece_cid': pieceCid },
    ],
  };

  if (publicOnly) {
    query.status = 'approved';
  }

  if (network) {
    query.network = network;
  }

  return query;
};

export const buildNestedCandidateQuery = ({ pieceCid, network, publicOnly, excludeIds }) => {
  const query = {
    isPublic: true,
    'fileStructure.children': { $exists: true },
    'pieces.piece_cid': { $ne: pieceCid },
    'fileStructure.piece_cid': { $ne: pieceCid },
  };

  if (publicOnly) {
    query.status = 'approved';
  }

  if (network) {
    query.network = network;
  }

  if (excludeIds.length > 0) {
    query._id = { $nin: excludeIds };
  }

  return query;
};

export const toResolveResult = (dataset) => ({
  id: dataset._id,
  uuid: dataset.uuid || dataset._id,
});

import {
  buildResolveQuery,
  isLikelyPieceCid,
  normalizePieceCid,
} from './datasetResolve.js';

describe('datasetResolve', () => {
  const pieceCid = 'baga6ea4seaqfmhhvyjyaqbmq4wdsjwlikxy2hs4zpoczr77lcthxcu5zsiupwgy';

  test('normalizePieceCid trims input', () => {
    expect(normalizePieceCid(`  ${pieceCid}  `)).toBe(pieceCid);
    expect(normalizePieceCid('')).toBeNull();
    expect(normalizePieceCid(null)).toBeNull();
  });

  test('isLikelyPieceCid requires baga prefix', () => {
    expect(isLikelyPieceCid(pieceCid)).toBe(true);
    expect(isLikelyPieceCid('bafkreie3msejhqu2vqkhyqfjnsbsq2w7o5udas7k43ecihj2ddlesgaewi')).toBe(false);
  });

  test('buildResolveQuery filters by pieces.piece_cid', () => {
    expect(buildResolveQuery({ pieceCid, network: 'mainnet', publicOnly: true })).toEqual({
      isPublic: true,
      status: 'approved',
      network: 'mainnet',
      'pieces.piece_cid': pieceCid,
    });
  });

});

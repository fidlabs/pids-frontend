import {
  buildResolveQuery,
  datasetContainsPieceCid,
  isLikelyPieceCid,
  normalizePieceCid,
  toResolveResult,
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

  test('datasetContainsPieceCid checks pieces and nested fileStructure', () => {
    const dataset = {
      pieces: [{ piece_cid: pieceCid, payload_cid: 'bafk...' }],
      fileStructure: [
        {
          name: 'nested.car',
          piece_cid: 'baga6ea4seaqother',
          children: [{ name: 'deep.car', piece_cid: pieceCid }],
        },
      ],
    };

    expect(datasetContainsPieceCid(dataset, pieceCid)).toBe(true);
    expect(datasetContainsPieceCid(dataset, 'baga6ea4seaqnotfound')).toBe(false);
    expect(datasetContainsPieceCid({ fileStructure: [] }, pieceCid)).toBe(false);
  });

  test('buildResolveQuery filters approved public datasets by default', () => {
    expect(buildResolveQuery({ pieceCid, network: 'mainnet', publicOnly: true })).toEqual({
      isPublic: true,
      status: 'approved',
      network: 'mainnet',
      $or: [
        { 'pieces.piece_cid': pieceCid },
        { 'fileStructure.piece_cid': pieceCid },
      ],
    });
  });

  test('toResolveResult prefers manifest uuid field', () => {
    expect(toResolveResult({ _id: '607be965-330e-4277-b559-b42dbf6c736b', uuid: '607be965-330e-4277-b559-b42dbf6c736b' })).toEqual({
      id: '607be965-330e-4277-b559-b42dbf6c736b',
      uuid: '607be965-330e-4277-b559-b42dbf6c736b',
    });
  });
});

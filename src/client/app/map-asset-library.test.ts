import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { LocalMapAssetMetadata } from '../../shared/mapAssets'
import {
  chooseDefaultBoardDefaults,
  deriveBoardDefaultsFromGeomorph,
  deriveMapAssetLabel,
  filterMapAssetCandidates,
  groupGeomorphAssetsByTileKind,
  groupMapAssetsByKind,
  groupMapAssetsByRoot,
  validateMapAssetCandidates
} from './map-asset-library'

const standardGeomorph: LocalMapAssetMetadata = {
  root: 'Geomorphs',
  relativePath: 'standard/deck-01.jpg',
  kind: 'geomorph',
  width: 1000,
  height: 1000,
  gridScale: 50,
  tileKind: 'standard'
}

const edgeGeomorph: LocalMapAssetMetadata = {
  root: 'Geomorphs',
  relativePath: 'edge/port-side.png',
  kind: 'geomorph',
  width: 1000,
  height: 530,
  gridScale: 50,
  tileKind: 'edge'
}

const counterSheet: LocalMapAssetMetadata = {
  root: 'Counters',
  relativePath: 'crew/free-trader.svg',
  kind: 'counter',
  width: 600,
  height: 600,
  gridScale: 50,
  tileKind: null
}

describe('map asset library helpers', () => {
  it('validates candidate metadata through shared map asset rules', () => {
    const result = validateMapAssetCandidates([
      {
        root: 'Geomorphs',
        relativePath: 'standard/deck-01.jpg',
        kind: 'geomorph',
        width: 1000,
        height: 1000,
        gridScale: 50
      },
      {
        root: 'Counters',
        relativePath: '../Geomorphs/deck-01.jpg',
        kind: 'counter',
        width: 600,
        height: 600,
        gridScale: 50
      }
    ])

    assert.equal(result.assets.length, 1)
    assert.equal(result.assets[0]?.tileKind, 'standard')
    assert.equal(result.errors.length, 1)
    assert.equal(
      /^Asset 1: Relative path must stay inside the local asset root\.$/.test(
        result.errors[0] || ''
      ),
      true
    )
  })

  it('filters candidates by kind, root, and geomorph tile kind', () => {
    const assets = [standardGeomorph, edgeGeomorph, counterSheet]

    assert.deepEqual(filterMapAssetCandidates(assets, { kind: 'counter' }), [
      counterSheet
    ])
    assert.deepEqual(filterMapAssetCandidates(assets, { root: 'Geomorphs' }), [
      standardGeomorph,
      edgeGeomorph
    ])
    assert.deepEqual(
      filterMapAssetCandidates(assets, {
        kind: 'geomorph',
        tileKind: 'edge'
      }),
      [edgeGeomorph]
    )
  })

  it('groups candidates by metadata dimensions used by the picker', () => {
    const assets = [standardGeomorph, edgeGeomorph, counterSheet]
    const byKind = groupMapAssetsByKind(assets)
    const byRoot = groupMapAssetsByRoot(assets)
    const byTileKind = groupGeomorphAssetsByTileKind(assets)

    assert.deepEqual(byKind.geomorph, [standardGeomorph, edgeGeomorph])
    assert.deepEqual(byKind.counter, [counterSheet])
    assert.deepEqual(byRoot.Geomorphs, [standardGeomorph, edgeGeomorph])
    assert.deepEqual(byRoot.Counters, [counterSheet])
    assert.deepEqual(byTileKind.standard, [standardGeomorph])
    assert.deepEqual(byTileKind.edge, [edgeGeomorph])
    assert.deepEqual(byTileKind.corner, [])
    assert.deepEqual(byTileKind.custom, [])
  })

  it('derives display labels without preserving path or unsafe markup chars', () => {
    assert.equal(deriveMapAssetLabel(standardGeomorph), 'deck 01')
    assert.equal(
      deriveMapAssetLabel({
        ...counterSheet,
        relativePath: 'crew/<Free_Trader>.svg'
      }),
      'Free Trader'
    )
    assert.equal(
      deriveMapAssetLabel({
        ...standardGeomorph,
        relativePath: '\u0000.jpg'
      }),
      'Geomorph asset'
    )
  })

  it('derives board defaults only from geomorph metadata', () => {
    assert.deepEqual(deriveBoardDefaultsFromGeomorph(edgeGeomorph), {
      width: 1000,
      height: 530,
      scale: 50
    })
    assert.equal(deriveBoardDefaultsFromGeomorph(counterSheet), null)
  })

  it('chooses standard geomorph board defaults when available', () => {
    assert.deepEqual(
      chooseDefaultBoardDefaults([
        counterSheet,
        edgeGeomorph,
        standardGeomorph
      ]),
      {
        width: 1000,
        height: 1000,
        scale: 50
      }
    )
    assert.deepEqual(
      chooseDefaultBoardDefaults([counterSheet, edgeGeomorph], 'corner'),
      {
        width: 1000,
        height: 530,
        scale: 50
      }
    )
    assert.equal(chooseDefaultBoardDefaults([counterSheet]), null)
  })
})

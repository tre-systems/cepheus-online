import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { LocalMapAssetMetadata } from '../../shared/mapAssets'
import {
  buildLocalMapAssetRef,
  deriveCounterPieceCommandDefaults,
  deriveGeomorphBoardCommandDefaults,
  deriveMapAssetPickerEmptyState,
  deriveMapAssetPickerItemViewModel,
  deriveMapAssetPickerSections,
  deriveMapAssetPickerViewModel,
  deriveMapAssetValidationSummary
} from './map-asset-picker-view'

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
  relativePath: 'edge/starboard-airlock.png',
  kind: 'geomorph',
  width: 1000,
  height: 530,
  gridScale: 50,
  tileKind: 'edge'
}

const customGeomorph: LocalMapAssetMetadata = {
  root: 'Geomorphs',
  relativePath: 'custom/<Secret_Bay>.webp',
  kind: 'geomorph',
  width: 700,
  height: 900,
  gridScale: 35,
  tileKind: 'custom'
}

const counter: LocalMapAssetMetadata = {
  root: 'Counters',
  relativePath: 'crew/free-trader.svg',
  kind: 'counter',
  width: 600,
  height: 600,
  gridScale: 50,
  tileKind: null
}

describe('map asset picker view helpers', () => {
  it('builds stable local asset references from validated metadata', () => {
    assert.equal(
      buildLocalMapAssetRef(standardGeomorph),
      'Geomorphs/standard/deck-01.jpg'
    )
    assert.equal(
      buildLocalMapAssetRef(counter),
      'Counters/crew/free-trader.svg'
    )
  })

  it('derives sanitized picker item labels with dimensions and defaults', () => {
    const item = deriveMapAssetPickerItemViewModel(customGeomorph)

    assert.equal(item.label, 'Secret Bay')
    assert.equal(item.dimensions.label, '700 x 900 px, 35 px grid')
    assert.equal(item.tileKind, 'custom')
    assert.deepEqual(item.boardDefaults, {
      name: 'Secret Bay',
      imageAssetId: 'Geomorphs/custom/<Secret_Bay>.webp',
      width: 700,
      height: 900,
      scale: 35
    })
    assert.equal(item.pieceDefaults, null)
  })

  it('derives recommended create-board defaults only for geomorphs', () => {
    assert.deepEqual(deriveGeomorphBoardCommandDefaults(edgeGeomorph), {
      name: 'starboard airlock',
      imageAssetId: 'Geomorphs/edge/starboard-airlock.png',
      width: 1000,
      height: 530,
      scale: 50
    })
    assert.equal(deriveGeomorphBoardCommandDefaults(counter), null)
  })

  it('derives counter piece defaults from counter metadata', () => {
    assert.deepEqual(deriveCounterPieceCommandDefaults(counter), {
      name: 'free trader',
      imageAssetId: 'Counters/crew/free-trader.svg',
      width: 600,
      height: 600,
      scale: 50 / 600
    })
    assert.equal(deriveCounterPieceCommandDefaults(standardGeomorph), null)
  })

  it('groups validated assets into non-empty picker sections', () => {
    const sections = deriveMapAssetPickerSections([
      counter,
      customGeomorph,
      standardGeomorph,
      edgeGeomorph
    ])

    assert.deepEqual(
      sections.map((section) => section.id),
      ['geomorph-standard', 'geomorph-edge', 'geomorph-custom', 'counter']
    )
    assert.deepEqual(
      sections.map((section) => section.title),
      [
        'Standard geomorph boards',
        'Edge geomorph boards',
        'Custom geomorph boards',
        'Counters'
      ]
    )
    assert.deepEqual(
      sections.flatMap((section) => section.items.map((item) => item.label)),
      ['deck 01', 'starboard airlock', 'Secret Bay', 'free trader']
    )
  })

  it('returns empty state only when there are no picker items', () => {
    assert.deepEqual(deriveMapAssetPickerEmptyState([]), {
      title: 'No local map assets',
      message: 'Validated Geomorphs or Counters metadata will appear here.'
    })
    assert.equal(
      deriveMapAssetPickerEmptyState(
        deriveMapAssetPickerSections([standardGeomorph])
      ),
      null
    )
  })

  it('summarizes validation errors with a display limit', () => {
    assert.deepEqual(
      deriveMapAssetValidationSummary(['First', 'Second', 'Third'], 2),
      {
        hasErrors: true,
        errorCount: 3,
        title: '3 local map asset validation error(s)',
        messages: ['First', 'Second', '1 more validation error(s).']
      }
    )
    assert.deepEqual(deriveMapAssetValidationSummary([]), {
      hasErrors: false,
      errorCount: 0,
      title: null,
      messages: []
    })
  })

  it('validates candidate metadata before deriving sections and summaries', () => {
    const viewModel = deriveMapAssetPickerViewModel([
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

    assert.equal(viewModel.emptyState, null)
    assert.deepEqual(
      viewModel.sections.map((section) => section.id),
      ['geomorph-standard']
    )
    assert.equal(viewModel.validationSummary.hasErrors, true)
    assert.equal(viewModel.validationSummary.errorCount, 1)
    assert.equal(
      /^Asset 1: Relative path must stay inside the local asset root\.$/.test(
        viewModel.validationSummary.messages[0] || ''
      ),
      true
    )
  })
})

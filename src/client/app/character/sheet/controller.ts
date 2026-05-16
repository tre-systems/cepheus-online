import type {
  BoardState,
  CharacterCreationProjection,
  CharacterEquipmentItem,
  CharacterSheetPatch,
  CharacterState,
  GameState,
  PieceFreedom,
  PieceState,
  PieceVisibility
} from '../../../../shared/state'
import {
  characterSheetEmptyLabels,
  characterSheetTitle,
  characteristicRows,
  characterSkills as deriveCharacterSkills,
  equipmentDisplayItems,
  selectedCharacter as selectCharacter,
  skillsFromText,
  skillRollReason
} from './view.js'
import {
  deriveCharacterExportViewModel,
  deriveCharacterUpp,
  derivePlainCharacterExport,
  formatLedgerEntryForExport,
  sortSkillsForExport
} from './export-view.js'

type CharacterSheetTab = 'details' | 'action' | 'items' | 'notes'

interface CharacterSheetElements {
  sheet: HTMLElement
  sheetName: HTMLElement
  sheetBody: HTMLElement
  sheetTabs: HTMLElement[]
}

interface CharacterSheetDocument {
  createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K
  ): HTMLElementTagNameMap[K]
}

interface CharacterSheetPatchTarget {
  id?: string | null
  characterId?: string | null
}

interface CharacterSheetDoorActions {
  actions: HTMLElement | null
}

interface CharacterSheetCreationActions {
  title: string
  status: string
  summary: string
  actions: HTMLElement | null
}

export interface CharacterSheetControllerOptions {
  elements: CharacterSheetElements
  document?: CharacterSheetDocument
  getSelectedPiece: () => PieceState | null
  getSelectedCharacter?: () => CharacterState | null
  getSelectedBoard: () => Pick<BoardState, 'name'> | null
  getCharacterState: () => Pick<GameState, 'characters'> | null | undefined
  canEditSheetFields?: (character: CharacterState) => boolean
  getBoardDoorActions: () => CharacterSheetDoorActions
  sendPatch: (
    target: string | CharacterSheetPatchTarget,
    patch: CharacterSheetPatch
  ) => Promise<unknown>
  setVisibility: (
    piece: PieceState,
    visibility: PieceVisibility
  ) => Promise<unknown>
  setFreedom: (piece: PieceState, freedom: PieceFreedom) => Promise<unknown>
  rollSkill: (
    piece: PieceState,
    character: CharacterState | null,
    skill: string,
    reason: string
  ) => Promise<unknown>
  addEquipmentItem: (
    characterId: string,
    item: CharacterEquipmentItem & { id: string }
  ) => Promise<unknown>
  updateEquipmentItem: (
    characterId: string,
    itemId: string,
    patch: Partial<CharacterEquipmentItem>
  ) => Promise<unknown>
  removeEquipmentItem: (characterId: string, itemId: string) => Promise<unknown>
  adjustCredits: (
    characterId: string,
    amount: number,
    reason: string
  ) => Promise<unknown>
  createEquipmentItemId?: (character: CharacterState) => string
  getCharacterCreationActions?: (
    character: CharacterState | null
  ) => CharacterSheetCreationActions | null
  reportError: (message: string) => void
}

export interface CharacterSheetController {
  isOpen: () => boolean
  setOpen: (open: boolean) => void
  toggleOpen: () => void
  render: () => void
  selectTab: (tab: string | null | undefined) => void
}

const characterSheetPatchTargetId = (
  target: string | CharacterSheetPatchTarget
) =>
  typeof target === 'string' ? target : target.characterId || target.id || null

export const nullableNumberFromValue = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const number = Number.parseInt(trimmed, 10)
  return Number.isFinite(number) ? number : null
}

export const createCharacterSheetController = ({
  elements,
  document: documentApi = document,
  getSelectedPiece,
  getSelectedCharacter,
  getSelectedBoard,
  getCharacterState,
  canEditSheetFields = () => true,
  getBoardDoorActions,
  sendPatch,
  setVisibility,
  setFreedom,
  rollSkill,
  addEquipmentItem,
  updateEquipmentItem,
  removeEquipmentItem,
  adjustCredits,
  createEquipmentItemId = (character) =>
    `equipment-${character.id}-${Date.now().toString(36)}`,
  getCharacterCreationActions,
  reportError
}: CharacterSheetControllerOptions): CharacterSheetController => {
  let sheetOpen = false
  let activeSheetTab: CharacterSheetTab = 'details'

  const handleAsyncError = (task: Promise<unknown>) => {
    task.catch((error: unknown) => {
      reportError(error instanceof Error ? error.message : String(error))
    })
  }

  const sendCharacterSheetPatch = (
    target: string | CharacterSheetPatchTarget,
    patch: CharacterSheetPatch
  ) => {
    const characterId = characterSheetPatchTargetId(target)
    if (!characterId || Object.keys(patch).length === 0) {
      return Promise.resolve()
    }
    return sendPatch(characterId, patch)
  }

  const sheetRow = (label: string, value: string) => {
    const row = documentApi.createElement('div')
    row.className = 'sheet-row'
    const labelEl = documentApi.createElement('span')
    labelEl.className = 'sheet-label'
    labelEl.textContent = label
    const valueEl = documentApi.createElement('span')
    valueEl.className = 'sheet-value'
    valueEl.textContent = value
    row.append(labelEl, valueEl)
    return row
  }

  const emptySheetText = (text: string) => {
    const empty = documentApi.createElement('p')
    empty.className = 'sheet-empty'
    empty.textContent = text
    return empty
  }

  const sheetSectionTitle = (text: string) => {
    const title = documentApi.createElement('h3')
    title.className = 'sheet-section-title'
    title.textContent = text
    return title
  }

  const sheetNotePreview = (text: string | null | undefined) => {
    const preview = documentApi.createElement('p')
    preview.className = 'sheet-note-preview'
    preview.textContent = text || 'No notes'
    return preview
  }

  const statStrip = (character: CharacterState | null) => {
    const stats = documentApi.createElement('div')
    stats.className = 'stat-strip'
    for (const { label, value, modifierLabel } of characteristicRows(
      character
    )) {
      const stat = documentApi.createElement('div')
      stat.className = 'stat'
      const name = documentApi.createElement('b')
      name.textContent = label
      const number = documentApi.createElement('span')
      number.className = 'stat-value'
      number.textContent = value
      const modifier = documentApi.createElement('span')
      modifier.className = 'stat-modifier'
      modifier.textContent = modifierLabel
      stat.append(name, number, modifier)
      stats.append(stat)
    }
    return stats
  }

  const nullableNumberFromInput = (input: HTMLInputElement) =>
    nullableNumberFromValue(input.value)

  const editableDetailsForm = (
    piece: PieceState | null,
    character: CharacterState | null
  ) => {
    if (!piece?.characterId || !character || !canEditSheetFields(character)) {
      return null
    }

    const form = documentApi.createElement('div')
    form.className = 'sheet-edit-form'
    const line = documentApi.createElement('div')
    line.className = 'sheet-edit-line'
    const ageLabel = documentApi.createElement('label')
    ageLabel.textContent = 'Age'
    const ageInput = documentApi.createElement('input')
    ageInput.name = 'age'
    ageInput.inputMode = 'numeric'
    ageInput.autocomplete = 'off'
    ageInput.value = character.age == null ? '' : String(character.age)
    ageLabel.append(ageInput)
    const save = documentApi.createElement('button')
    save.type = 'button'
    save.textContent = 'Save'
    line.append(ageLabel, save)

    const statFields = documentApi.createElement('div')
    statFields.className = 'sheet-stat-edit'
    const inputs: Record<string, HTMLInputElement> = {}
    for (const { label, key, inputValue } of characteristicRows(character)) {
      const field = documentApi.createElement('label')
      field.textContent = label
      const input = documentApi.createElement('input')
      input.name = key
      input.inputMode = 'numeric'
      input.autocomplete = 'off'
      input.value = inputValue
      inputs[key] = input
      field.append(input)
      statFields.append(field)
    }

    save.addEventListener('click', () => {
      handleAsyncError(
        sendCharacterSheetPatch(
          { characterId: piece.characterId },
          {
            age: nullableNumberFromInput(ageInput),
            characteristics: {
              str: nullableNumberFromInput(inputs.str),
              dex: nullableNumberFromInput(inputs.dex),
              end: nullableNumberFromInput(inputs.end),
              int: nullableNumberFromInput(inputs.int),
              edu: nullableNumberFromInput(inputs.edu),
              soc: nullableNumberFromInput(inputs.soc)
            }
          }
        )
      )
    })

    form.append(line, statFields)
    return form
  }

  const skillChips = (skills: string[]) => {
    const chips = documentApi.createElement('div')
    chips.className = 'chip-list'
    for (const label of skills) {
      const chip = documentApi.createElement('span')
      chip.textContent = label
      chips.append(chip)
    }
    return chips
  }

  const displayedCharacterSkills = (
    character: CharacterState | null
  ): string[] => sortSkillsForExport(deriveCharacterSkills(character))

  const visibilityActions = (piece: PieceState) => {
    const actions = documentApi.createElement('div')
    actions.className = 'sheet-actions'
    for (const visibility of ['HIDDEN', 'PREVIEW', 'VISIBLE'] as const) {
      const button = documentApi.createElement('button')
      button.type = 'button'
      button.textContent =
        visibility === 'HIDDEN' ? 'Hide' : visibility.toLowerCase()
      button.className = piece.visibility === visibility ? 'active' : ''
      button.addEventListener('click', () => {
        handleAsyncError(setVisibility(piece, visibility))
      })
      actions.append(button)
    }
    return actions
  }

  const freedomActions = (piece: PieceState) => {
    const actions = documentApi.createElement('div')
    actions.className = 'sheet-actions'
    for (const freedom of ['LOCKED', 'UNLOCKED', 'SHARE'] as const) {
      const button = documentApi.createElement('button')
      button.type = 'button'
      button.textContent = freedom === 'LOCKED' ? 'Lock' : freedom.toLowerCase()
      button.className = piece.freedom === freedom ? 'active' : ''
      button.addEventListener('click', () => {
        handleAsyncError(setFreedom(piece, freedom))
      })
      actions.append(button)
    }
    return actions
  }

  const appendDoorActions = (body: HTMLElement) => {
    const doorActions = getBoardDoorActions().actions
    if (doorActions) body.append(sheetSectionTitle('Doors'), doorActions)
  }

  const appendCreationActions = (
    body: HTMLElement,
    character: CharacterState | null
  ) => {
    const creationActions = getCharacterCreationActions?.(character)
    if (!creationActions) return

    body.append(
      sheetSectionTitle(creationActions.title),
      sheetRow('Status', creationActions.status),
      emptySheetText(creationActions.summary)
    )
    if (creationActions.actions) body.append(creationActions.actions)
  }

  const appendPlainCharacterExport = (
    body: HTMLElement,
    character: CharacterState | null
  ) => {
    const exportText = derivePlainCharacterExport(character)
    if (!exportText) return

    const block = documentApi.createElement('pre')
    block.className = 'sheet-export-block'
    block.textContent = exportText
    body.append(sheetSectionTitle('Plain Export'), block)
  }

  const appendCreditLedger = (
    body: HTMLElement,
    character: CharacterState | null
  ) => {
    const ledger = character?.ledger ?? []
    if (ledger.length === 0) return

    const list = documentApi.createElement('div')
    list.className = 'sheet-ledger-list'
    for (const entry of ledger) {
      const row = documentApi.createElement('p')
      row.className = 'sheet-ledger-entry'
      row.textContent = formatLedgerEntryForExport(entry)
      list.append(row)
    }
    body.append(sheetSectionTitle('Credit Ledger'), list)
  }

  const appendFinalCharacterSummary = (
    body: HTMLElement,
    character: CharacterState | null
  ) => {
    const exportView = deriveCharacterExportViewModel(character)
    if (!exportView) return

    const card = documentApi.createElement('div')
    card.className = 'sheet-final-card'
    const title = documentApi.createElement('strong')
    title.textContent = exportView.title
    const upp = documentApi.createElement('span')
    upp.className = 'sheet-final-upp'
    upp.textContent = exportView.upp
    const meta = documentApi.createElement('small')
    meta.textContent = `${exportView.type} - Age ${exportView.age} - ${exportView.terms} ${exportView.terms === 1 ? 'term' : 'terms'}`
    const career = documentApi.createElement('p')
    career.textContent = exportView.careers
    const stats = documentApi.createElement('div')
    stats.className = 'sheet-final-stat-grid'
    for (const row of characteristicRows(character)) {
      const stat = documentApi.createElement('span')
      stat.className = 'sheet-final-stat'
      const label = documentApi.createElement('small')
      label.textContent = row.label
      const value = documentApi.createElement('strong')
      value.textContent = row.value
      const modifier = documentApi.createElement('em')
      modifier.textContent = row.modifierLabel || '0'
      stat.append(label, value, modifier)
      stats.append(stat)
    }
    const skills = sortSkillsForExport(character?.skills ?? [])
    const skillList = documentApi.createElement('div')
    skillList.className = 'sheet-final-skill-list'
    for (const skill of skills) {
      const chip = documentApi.createElement('span')
      chip.className = 'sheet-final-skill-chip'
      chip.textContent = skill
      skillList.append(chip)
    }
    card.append(title, upp, meta, career, stats)
    if (skills.length > 0) card.append(skillList)

    body.append(
      sheetSectionTitle('Final Character'),
      card,
      sheetRow('UPP', exportView.upp),
      sheetRow('Characteristics', exportView.characteristics),
      sheetRow('Homeworld', exportView.homeworld),
      sheetRow('Careers', exportView.careers),
      sheetRow('Terms', String(exportView.terms)),
      sheetRow('Skills', exportView.skills),
      sheetRow('Credits', exportView.credits),
      sheetRow('Equipment', exportView.equipment)
    )
    if (exportView.ledger.length > 0) {
      const ledger = documentApi.createElement('div')
      ledger.className = 'sheet-ledger-list'
      for (const entry of exportView.ledger) {
        const row = documentApi.createElement('p')
        row.className = 'sheet-ledger-entry'
        row.textContent = entry
        ledger.append(row)
      }
      body.append(sheetSectionTitle('Credit Ledger'), ledger)
    }
    if (exportView.careerHistory.length > 0) {
      const history = documentApi.createElement('div')
      history.className = 'sheet-career-history'
      for (const term of exportView.careerHistory) {
        const entry = documentApi.createElement('p')
        entry.className = 'sheet-career-term-card'
        entry.textContent = term
        history.append(entry)
      }
      body.append(sheetSectionTitle('Career History'), history)
    }
  }

  const creationEventLabel = (type: string) =>
    type
      .replace(/^CharacterCreation/, '')
      .replace(/^Character/, '')
      .replaceAll('_', ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()

  const creationRows = (creation: CharacterCreationProjection | null) => {
    if (!creation) return [sheetRow('Creation', 'Not started')]
    const rows = [
      sheetRow('Creation', creation.state.status.replaceAll('_', ' ')),
      sheetRow('Terms', String(creation.terms.length)),
      sheetRow('Complete', creation.creationComplete ? 'Yes' : 'No')
    ]
    const career = creation.careers.at(-1)
    if (career) rows.splice(2, 0, sheetRow('Career', career.name))
    if (creation.timeline && creation.timeline.length > 0) {
      rows.push(sheetRow('Steps', String(creation.timeline.length)))
      rows.push(
        sheetRow(
          'Latest',
          creationEventLabel(creation.timeline.at(-1)?.eventType ?? '')
        )
      )
    }
    return rows
  }

  const skillEditor = (
    piece: PieceState,
    character: CharacterState | null,
    skills: string[]
  ) => {
    if (!piece.characterId || !character || !canEditSheetFields(character)) {
      return null
    }

    const form = documentApi.createElement('div')
    form.className = 'sheet-skill-editor'
    const label = documentApi.createElement('label')
    label.textContent = 'Skills'
    const textarea = documentApi.createElement('textarea')
    textarea.value = skills.join('\n')
    textarea.placeholder = 'Vacc Suit-0\\nGun Combat-0'
    textarea.spellcheck = false
    const save = documentApi.createElement('button')
    save.type = 'button'
    save.textContent = 'Save skills'
    save.addEventListener('click', () => {
      handleAsyncError(
        sendCharacterSheetPatch(
          { characterId: piece.characterId },
          { skills: skillsFromText(textarea.value) }
        )
      )
    })
    label.append(textarea)
    form.append(label, save)
    return form
  }

  const renderDetailsTab = (
    body: HTMLElement,
    piece: PieceState,
    character: CharacterState | null
  ) => {
    if (!character) {
      body.append(
        sheetSectionTitle('Token'),
        sheetRow('Name', piece.name),
        sheetRow('Position', `${Math.round(piece.x)}, ${Math.round(piece.y)}`),
        sheetRow('Visibility', piece.visibility),
        visibilityActions(piece),
        sheetRow('Move', piece.freedom),
        freedomActions(piece),
        emptySheetText(characterSheetEmptyLabels.noLinkedCharacterSheet)
      )
      appendDoorActions(body)
      return
    }

    body.append(
      sheetSectionTitle('Profile'),
      sheetRow('Type', character.type || 'PLAYER'),
      sheetRow('Age', character.age == null ? '-' : String(character.age)),
      sheetRow('UPP', deriveCharacterUpp(character.characteristics)),
      statStrip(character),
      ...creationRows(character.creation),
      sheetSectionTitle('Token'),
      sheetRow('Position', `${Math.round(piece.x)}, ${Math.round(piece.y)}`),
      sheetRow('Visibility', piece.visibility),
      visibilityActions(piece),
      sheetRow('Move', piece.freedom),
      freedomActions(piece),
      sheetSectionTitle('Skills'),
      skillChips(displayedCharacterSkills(character))
    )
    appendFinalCharacterSummary(body, character)
    const editor = editableDetailsForm(piece, character)
    if (editor) body.append(sheetSectionTitle('Referee Correction'), editor)
    appendPlainCharacterExport(body, character)
    appendDoorActions(body)
  }

  const renderActionTab = (
    body: HTMLElement,
    piece: PieceState,
    character: CharacterState | null
  ) => {
    appendCreationActions(body, character)
    const skills = displayedCharacterSkills(character)
    if (skills.length === 0) {
      body.append(emptySheetText(characterSheetEmptyLabels.noTrainedSkills))
      return
    }

    const actions = documentApi.createElement('div')
    actions.className = 'sheet-skill-actions'
    body.append(sheetSectionTitle('Roll'))
    for (const skill of skills) {
      const button = documentApi.createElement('button')
      button.type = 'button'
      button.textContent = skill
      button.addEventListener('click', () => {
        handleAsyncError(
          rollSkill(
            piece,
            character,
            skill,
            skillRollReason(piece, character, skill)
          )
        )
      })
      actions.append(button)
    }
    const editor = skillEditor(piece, character, skills)
    if (editor)
      body.append(
        actions,
        sheetSectionTitle('Referee Skill Correction'),
        editor
      )
    else body.append(actions)
  }

  const itemsEditor = (character: CharacterState | null) => {
    if (!character || !canEditSheetFields(character)) return null
    const equipment = Array.isArray(character.equipment)
      ? character.equipment
      : []

    const form = documentApi.createElement('div')
    form.className = 'sheet-items-editor'
    const creditLine = documentApi.createElement('div')
    creditLine.className = 'sheet-edit-line'
    const amountLabel = documentApi.createElement('label')
    amountLabel.textContent = 'Credit change'
    const amountInput = documentApi.createElement('input')
    amountInput.name = 'creditAmount'
    amountInput.inputMode = 'numeric'
    amountInput.autocomplete = 'off'
    amountInput.placeholder = '-250'
    amountLabel.append(amountInput)
    const reasonLabel = documentApi.createElement('label')
    reasonLabel.textContent = 'Reason'
    const reasonInput = documentApi.createElement('input')
    reasonInput.name = 'creditReason'
    reasonInput.autocomplete = 'off'
    reasonInput.placeholder = 'Bought ammunition'
    reasonLabel.append(reasonInput)
    const creditSave = documentApi.createElement('button')
    creditSave.type = 'button'
    creditSave.textContent = 'Record credits'
    creditSave.addEventListener('click', () => {
      const amount = nullableNumberFromInput(amountInput)
      const reason = reasonInput.value.trim()
      if (amount === null || amount === 0 || !reason) {
        reportError('Credit changes need a non-zero amount and reason')
        return
      }
      handleAsyncError(adjustCredits(character.id, amount, reason))
    })
    creditLine.append(amountLabel, reasonLabel, creditSave)

    const equipmentRows = documentApi.createElement('div')
    equipmentRows.className = 'sheet-equipment-rows'

    const appendEditableEquipmentRow = (item: CharacterEquipmentItem) => {
      const row = documentApi.createElement('div')
      row.className = 'sheet-equipment-row'
      const name = documentApi.createElement('input')
      name.name = 'equipmentName'
      name.autocomplete = 'off'
      name.placeholder = 'Item'
      name.value = item?.name || ''
      const quantity = documentApi.createElement('input')
      quantity.name = 'equipmentQuantity'
      quantity.inputMode = 'numeric'
      quantity.autocomplete = 'off'
      quantity.placeholder = 'Qty'
      quantity.value =
        item?.quantity == null ? '1' : String(Math.max(1, item.quantity))
      const notes = documentApi.createElement('input')
      notes.name = 'equipmentNotes'
      notes.autocomplete = 'off'
      notes.placeholder = 'Notes'
      notes.value = item?.notes || ''
      const save = documentApi.createElement('button')
      save.type = 'button'
      save.textContent = 'Update'
      save.addEventListener('click', () => {
        const itemId = item.id ?? item.name
        handleAsyncError(
          updateEquipmentItem(character.id, itemId, {
            name: name.value.trim(),
            quantity: nullableNumberFromInput(quantity) ?? 1,
            notes: notes.value.trim()
          })
        )
      })
      const remove = documentApi.createElement('button')
      remove.type = 'button'
      remove.textContent = 'Remove'
      remove.addEventListener('click', () => {
        handleAsyncError(
          removeEquipmentItem(character.id, item.id ?? item.name)
        )
      })
      row.append(name, quantity, notes, save, remove)
      equipmentRows.append(row)
    }

    for (const item of equipment) appendEditableEquipmentRow(item)

    const addRow = documentApi.createElement('div')
    addRow.className = 'sheet-equipment-row'
    const newName = documentApi.createElement('input')
    newName.name = 'newEquipmentName'
    newName.autocomplete = 'off'
    newName.placeholder = 'New item'
    const newQuantity = documentApi.createElement('input')
    newQuantity.name = 'newEquipmentQuantity'
    newQuantity.inputMode = 'numeric'
    newQuantity.autocomplete = 'off'
    newQuantity.placeholder = 'Qty'
    newQuantity.value = '1'
    const newNotes = documentApi.createElement('input')
    newNotes.name = 'newEquipmentNotes'
    newNotes.autocomplete = 'off'
    newNotes.placeholder = 'Notes'
    const addItem = documentApi.createElement('button')
    addItem.type = 'button'
    addItem.textContent = 'Add item'
    addItem.addEventListener('click', () => {
      const name = newName.value.trim()
      if (!name) {
        reportError('Equipment item name is required')
        return
      }
      handleAsyncError(
        addEquipmentItem(character.id, {
          id: createEquipmentItemId(character),
          name,
          quantity: nullableNumberFromInput(newQuantity) ?? 1,
          notes: newNotes.value.trim()
        })
      )
    })
    addRow.append(newName, newQuantity, newNotes, addItem)

    form.append(creditLine, equipmentRows, addRow)
    return form
  }

  const renderItemsTab = (
    body: HTMLElement,
    character: CharacterState | null
  ) => {
    body.append(
      sheetSectionTitle('Resources'),
      sheetRow(
        'Credits',
        character?.credits == null ? '-' : String(character.credits)
      )
    )
    const equipment = Array.isArray(character?.equipment)
      ? character.equipment
      : []
    if (equipment.length === 0) {
      body.append(emptySheetText(characterSheetEmptyLabels.noEquipmentListed))
      appendCreditLedger(body, character)
      const editor = itemsEditor(character)
      if (editor)
        body.append(sheetSectionTitle('Referee Resource Correction'), editor)
      return
    }

    const list = documentApi.createElement('div')
    list.className = 'item-list'
    body.append(sheetSectionTitle('Equipment'))
    for (const item of equipmentDisplayItems(equipment)) {
      const row = documentApi.createElement('div')
      row.className = 'item-row'
      const name = documentApi.createElement('span')
      name.className = 'item-name'
      name.textContent = item.name
      const meta = documentApi.createElement('span')
      meta.className = 'item-meta'
      meta.textContent = item.meta
      row.append(name, meta)
      if (item.notes) {
        const note = documentApi.createElement('span')
        note.className = 'item-note'
        note.textContent = item.notes
        row.append(note)
      }
      list.append(row)
    }
    const editor = itemsEditor(character)
    body.append(list)
    appendCreditLedger(body, character)
    if (editor)
      body.append(sheetSectionTitle('Referee Resource Correction'), editor)
  }

  const renderCharacterOnlyDetailsTab = (
    body: HTMLElement,
    character: CharacterState
  ) => {
    body.append(
      sheetSectionTitle('Profile'),
      sheetRow('Type', character.type || 'PLAYER'),
      sheetRow('Age', character.age == null ? '-' : String(character.age)),
      sheetRow('UPP', deriveCharacterUpp(character.characteristics)),
      statStrip(character),
      ...creationRows(character.creation),
      sheetSectionTitle('Skills'),
      skillChips(displayedCharacterSkills(character))
    )
    const editor = editableDetailsForm(null, character)
    if (editor) body.append(sheetSectionTitle('Referee Correction'), editor)
    appendPlainCharacterExport(body, character)
    appendDoorActions(body)
  }

  const renderCharacterOnlyActionTab = (
    body: HTMLElement,
    character: CharacterState
  ) => {
    appendCreationActions(body, character)
    const skills = displayedCharacterSkills(character)
    if (skills.length > 0) {
      body.append(sheetSectionTitle('Skills'), skillChips(skills))
    }
    body.append(emptySheetText('No board token selected'))
  }

  const renderCharacterOnlyNotesTab = (
    body: HTMLElement,
    character: CharacterState
  ) => {
    const form = documentApi.createElement('div')
    form.className = 'sheet-notes-form'
    const textarea = documentApi.createElement('textarea')
    textarea.value = character.notes || ''
    textarea.placeholder = 'No notes'
    textarea.spellcheck = true
    const save = documentApi.createElement('button')
    save.type = 'button'
    save.textContent = 'Save'
    save.addEventListener('click', () => {
      handleAsyncError(
        sendCharacterSheetPatch(
          { characterId: character.id },
          { notes: textarea.value }
        )
      )
    })
    form.append(textarea, save)
    body.append(
      sheetSectionTitle('Current Notes'),
      sheetNotePreview(character.notes),
      sheetSectionTitle('Edit Notes'),
      form
    )
  }

  const renderNotesTab = (
    body: HTMLElement,
    piece: PieceState,
    character: CharacterState | null
  ) => {
    if (!piece.characterId || !character) {
      body.append(
        sheetSectionTitle('Notes'),
        emptySheetText(character?.notes || characterSheetEmptyLabels.noNotes)
      )
      return
    }

    const form = documentApi.createElement('div')
    form.className = 'sheet-notes-form'
    const textarea = documentApi.createElement('textarea')
    textarea.value = character.notes || ''
    textarea.placeholder = 'No notes'
    textarea.spellcheck = true
    const save = documentApi.createElement('button')
    save.type = 'button'
    save.textContent = 'Save'
    save.addEventListener('click', () => {
      handleAsyncError(
        sendCharacterSheetPatch(
          { characterId: piece.characterId },
          { notes: textarea.value }
        )
      )
    })
    form.append(textarea, save)
    body.append(
      sheetSectionTitle('Current Notes'),
      sheetNotePreview(character.notes),
      sheetSectionTitle('Edit Notes'),
      form
    )
  }

  const render = () => {
    const piece = getSelectedPiece()
    const state = getCharacterState()
    const character = piece
      ? selectCharacter(state, piece)
      : (getSelectedCharacter?.() ?? null)
    elements.sheetName.textContent = characterSheetTitle(piece, character)
    for (const tab of elements.sheetTabs) {
      tab.classList.toggle('active', tab.dataset.sheetTab === activeSheetTab)
    }

    const body = documentApi.createElement('div')
    body.className = 'sheet-grid'
    if (!piece && !character) {
      body.append(sheetRow('Status', characterSheetEmptyLabels.noActiveToken))
      body.append(sheetRow('Board', getSelectedBoard()?.name || 'None'))
      appendDoorActions(body)
      elements.sheetBody.replaceChildren(body)
      return
    }

    if (!piece && character) {
      if (activeSheetTab === 'action')
        renderCharacterOnlyActionTab(body, character)
      else if (activeSheetTab === 'items') renderItemsTab(body, character)
      else if (activeSheetTab === 'notes')
        renderCharacterOnlyNotesTab(body, character)
      else renderCharacterOnlyDetailsTab(body, character)
      elements.sheetBody.replaceChildren(body)
      return
    }

    if (!piece) return
    const selectedPiece = piece
    if (activeSheetTab === 'action')
      renderActionTab(body, selectedPiece, character)
    else if (activeSheetTab === 'items') renderItemsTab(body, character)
    else if (activeSheetTab === 'notes')
      renderNotesTab(body, selectedPiece, character)
    else renderDetailsTab(body, selectedPiece, character)
    elements.sheetBody.replaceChildren(body)
  }

  const setOpen = (open: boolean) => {
    sheetOpen = open
    elements.sheet.classList.toggle('open', sheetOpen)
  }

  return {
    isOpen: () => sheetOpen,
    setOpen,
    toggleOpen: () => setOpen(!sheetOpen),
    render,
    selectTab: (tab) => {
      if (
        tab === 'action' ||
        tab === 'items' ||
        tab === 'notes' ||
        tab === 'details'
      ) {
        activeSheetTab = tab
      } else {
        activeSheetTab = 'details'
      }
      render()
    }
  }
}

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
  deriveCharacterUpp,
  derivePlainCharacterExport
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

  const creationEventLabel = (type: string) =>
    type
      .toLowerCase()
      .split('_')
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
      .join(' ')

  const creationRows = (creation: CharacterCreationProjection | null) => {
    if (!creation) return [sheetRow('Creation', 'Not started')]
    const rows = [
      sheetRow('Creation', creation.state.status.replaceAll('_', ' ')),
      sheetRow('Terms', String(creation.terms.length)),
      sheetRow('Complete', creation.creationComplete ? 'Yes' : 'No')
    ]
    const career = creation.careers.at(-1)
    if (career) rows.splice(2, 0, sheetRow('Career', career.name))
    if (creation.history && creation.history.length > 0) {
      rows.push(sheetRow('Steps', String(creation.history.length)))
      rows.push(
        sheetRow(
          'Latest',
          creationEventLabel(creation.history.at(-1)?.type ?? '')
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
      skillChips(deriveCharacterSkills(character))
    )
    const editor = editableDetailsForm(piece, character)
    if (editor) body.append(sheetSectionTitle('Edit'), editor)
    appendPlainCharacterExport(body, character)
    appendDoorActions(body)
  }

  const renderActionTab = (
    body: HTMLElement,
    piece: PieceState,
    character: CharacterState | null
  ) => {
    appendCreationActions(body, character)
    const skills = deriveCharacterSkills(character)
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
    if (editor) body.append(actions, sheetSectionTitle('Edit Skills'), editor)
    else body.append(actions)
  }

  const itemsEditor = (character: CharacterState | null) => {
    if (!character || !canEditSheetFields(character)) return null
    const equipment = Array.isArray(character.equipment)
      ? character.equipment
      : []

    const form = documentApi.createElement('div')
    form.className = 'sheet-items-editor'
    const creditsLabel = documentApi.createElement('label')
    creditsLabel.textContent = 'Credits'
    const creditsInput = documentApi.createElement('input')
    creditsInput.name = 'credits'
    creditsInput.inputMode = 'numeric'
    creditsInput.autocomplete = 'off'
    creditsInput.value =
      character.credits == null ? '0' : String(character.credits)
    creditsLabel.append(creditsInput)

    const equipmentRows = documentApi.createElement('div')
    equipmentRows.className = 'sheet-equipment-rows'
    const rowInputs: Array<{
      name: HTMLInputElement
      quantity: HTMLInputElement
      notes: HTMLInputElement
    }> = []

    const appendEquipmentRow = (item?: Partial<CharacterEquipmentItem>) => {
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
      rowInputs.push({ name, quantity, notes })
      row.append(name, quantity, notes)
      equipmentRows.append(row)
    }

    for (const item of equipment) appendEquipmentRow(item)
    if (equipment.length === 0) appendEquipmentRow()

    const addItem = documentApi.createElement('button')
    addItem.type = 'button'
    addItem.textContent = 'Add item'
    addItem.addEventListener('click', () => {
      appendEquipmentRow()
    })

    const save = documentApi.createElement('button')
    save.type = 'button'
    save.textContent = 'Save items'
    save.addEventListener('click', () => {
      const nextEquipment = rowInputs
        .map(({ name, quantity, notes }) => ({
          name: name.value.trim(),
          quantity: nullableNumberFromInput(quantity) ?? 1,
          notes: notes.value.trim()
        }))
        .filter((item) => item.name.length > 0)
      handleAsyncError(
        sendCharacterSheetPatch(
          { characterId: character.id },
          {
            credits: nullableNumberFromInput(creditsInput) ?? 0,
            equipment: nextEquipment
          }
        )
      )
    })

    form.append(creditsLabel, equipmentRows, addItem, save)
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
      const editor = itemsEditor(character)
      if (editor) body.append(sheetSectionTitle('Edit Items'), editor)
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
    if (editor) body.append(list, sheetSectionTitle('Edit Items'), editor)
    else body.append(list)
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
      skillChips(deriveCharacterSkills(character))
    )
    const editor = editableDetailsForm(null, character)
    if (editor) body.append(sheetSectionTitle('Edit'), editor)
    appendPlainCharacterExport(body, character)
    appendDoorActions(body)
  }

  const renderCharacterOnlyActionTab = (
    body: HTMLElement,
    character: CharacterState
  ) => {
    appendCreationActions(body, character)
    const skills = deriveCharacterSkills(character)
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

import type {
  CharacterCreationCascadeSkillChoiceViewModel,
  CharacterCreationFieldViewModel,
  CharacterCreationHomeworldOptionViewModel,
  CharacterCreationHomeworldViewModel,
  CharacterCreationPendingCascadeChoiceViewModel,
  CharacterCreationTermCascadeChoicesViewModel
} from './character-creation-view.js'

export interface CharacterCreationHomeworldDocument {
  createElement(tagName: 'button'): HTMLButtonElement
  createElement(tagName: 'label'): HTMLLabelElement
  createElement(tagName: 'option'): HTMLOptionElement
  createElement(tagName: 'select'): HTMLSelectElement
  createElement(tagName: string): HTMLElement
  createDocumentFragment(): DocumentFragment
}

export interface CharacterCreationHomeworldViewDeps {
  toggleBackgroundSkill: (option: {
    label: string
    selected: boolean
    cascade: boolean
  }) => void
  resolveCascadeSkill: (choice: {
    scope: 'background' | 'term'
    cascadeSkill: string
    selection: string
  }) => void
}

export const renderCharacterCreationHomeworld = (
  document: CharacterCreationHomeworldDocument,
  viewModel: CharacterCreationHomeworldViewModel,
  deps: Pick<
    CharacterCreationHomeworldViewDeps,
    'toggleBackgroundSkill' | 'resolveCascadeSkill'
  >
): HTMLElement => {
  const wrapper = document.createElement('div')
  wrapper.className = 'creation-homeworld'

  const fieldGrid = document.createElement('div')
  fieldGrid.className = 'creation-homeworld-fields'

  const lawField = viewModel.fields.find(
    (field) => field.key === 'homeworld.lawLevel'
  )
  const tradeField = viewModel.fields.find(
    (field) => field.key === 'homeworld.tradeCodes'
  )

  if (lawField) {
    fieldGrid.append(
      renderCharacterCreationOptionField(
        document,
        lawField,
        viewModel.lawLevelOptions
      )
    )
  }
  if (tradeField) {
    fieldGrid.append(
      renderCharacterCreationOptionField(
        document,
        tradeField,
        viewModel.tradeCodeOptions
      )
    )
  }

  const summary = document.createElement('div')
  summary.className = 'creation-homeworld-summary'
  const title = document.createElement('strong')
  title.textContent = 'Background skills'
  const detail = document.createElement('p')
  detail.textContent = backgroundSkillSummaryText(viewModel)
  const skillList = renderCharacterCreationBackgroundSkills(
    document,
    viewModel,
    deps
  )

  summary.append(title, detail, skillList)
  wrapper.append(fieldGrid, summary)
  return wrapper
}

export const renderCharacterCreationTermCascadeChoices = (
  document: CharacterCreationHomeworldDocument,
  viewModel: CharacterCreationTermCascadeChoicesViewModel,
  deps: Pick<CharacterCreationHomeworldViewDeps, 'resolveCascadeSkill'>
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-term-skills'
  const title = document.createElement('strong')
  title.textContent = viewModel.title
  const text = document.createElement('p')
  text.textContent = viewModel.prompt
  panel.append(title, text)

  for (const cascade of viewModel.choices) {
    panel.append(
      renderCharacterCreationCascadeChoice(document, cascade, 'term', deps)
    )
  }

  return panel
}

const backgroundSkillSummaryText = (
  viewModel: CharacterCreationHomeworldViewModel
): string => {
  const selectedCount =
    viewModel.backgroundSkills.selectedSkills.length +
    viewModel.backgroundSkills.pendingCascadeSkills.length
  const remaining = viewModel.backgroundSkills.remainingSelections
  const grantedCount = viewModel.backgroundSkills.skillOptions.filter(
    (option) => option.preselected
  ).length
  const pendingCascadeCount =
    viewModel.backgroundSkills.cascadeSkillChoices.length

  if (pendingCascadeCount > 0) {
    return `Choose ${pendingCascadeCount === 1 ? 'a specialty' : 'specialties'} for the granted cascade skill.`
  }
  if (remaining > 0) {
    return `${selectedCount}/${viewModel.backgroundSkills.allowance} selected. Choose ${remaining} more.`
  }
  return `${selectedCount}/${viewModel.backgroundSkills.allowance} selected. ${
    grantedCount > 0 ? `${grantedCount} granted by homeworld.` : ''
  }`
}

const renderCharacterCreationBackgroundSkills = (
  document: CharacterCreationHomeworldDocument,
  viewModel: CharacterCreationHomeworldViewModel,
  {
    toggleBackgroundSkill
  }: Pick<CharacterCreationHomeworldViewDeps, 'toggleBackgroundSkill'>
): HTMLElement => {
  const list = document.createElement('div')
  list.className = 'creation-background-options'
  const remaining = viewModel.backgroundSkills.remainingSelections

  for (const option of viewModel.backgroundSkills.skillOptions) {
    const button = document.createElement('button')
    button.type = 'button'
    const unavailable = !option.selected && remaining <= 0
    button.className = [
      option.selected ? 'selected' : '',
      option.preselected ? 'preselected' : '',
      unavailable ? 'unavailable' : ''
    ]
      .filter(Boolean)
      .join(' ')
    button.textContent = option.label
    button.disabled = option.preselected || unavailable
    button.title = option.preselected
      ? 'Granted by homeworld'
      : option.selected
        ? 'Remove selection'
        : option.cascade
          ? 'Select, then choose a specialty'
          : 'Select background skill'
    button.addEventListener('click', () => {
      toggleBackgroundSkill({
        label: option.label,
        selected: option.selected,
        cascade: option.cascade
      })
    })
    list.append(button)
  }

  return list
}

export const renderCharacterCreationCascadeChoice = (
  document: CharacterCreationHomeworldDocument,
  cascade:
    | CharacterCreationCascadeSkillChoiceViewModel
    | CharacterCreationPendingCascadeChoiceViewModel,
  scope: 'background' | 'term',
  {
    resolveCascadeSkill
  }: Pick<CharacterCreationHomeworldViewDeps, 'resolveCascadeSkill'>
): HTMLElement => {
  const panel = document.createElement('div')
  panel.className = 'creation-cascade-choice'
  const title = document.createElement('strong')
  title.textContent =
    'title' in cascade ? cascade.title : `${cascade.label}-${cascade.level}`
  const options = document.createElement('div')
  options.className = 'creation-background-options'

  if ('prompt' in cascade) {
    const prompt = document.createElement('p')
    prompt.textContent = cascade.prompt
    panel.append(title, prompt)
  } else {
    panel.append(title)
  }

  for (const option of cascade.options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = option.label
    button.title = option.cascade
      ? 'This opens another cascade choice'
      : 'Resolve cascade skill'
    button.addEventListener('click', () => {
      resolveCascadeSkill({
        scope,
        cascadeSkill: cascade.cascadeSkill,
        selection: option.label
      })
    })
    options.append(button)
  }

  panel.append(options)
  return panel
}

const renderCharacterCreationOptionField = (
  document: CharacterCreationHomeworldDocument,
  field: CharacterCreationFieldViewModel,
  options: readonly CharacterCreationHomeworldOptionViewModel[]
): HTMLLabelElement => {
  const label = document.createElement('label')
  label.className = `character-creation-field ${field.kind}`
  const name = document.createElement('span')
  name.textContent = field.required ? `${field.label} *` : field.label
  const control = document.createElement('select')
  control.dataset.characterCreationField = field.key
  control.autocomplete = 'off'

  const empty = document.createElement('option')
  empty.value = ''
  empty.textContent = `Select ${field.label.toLowerCase()}`
  control.append(empty)

  for (const option of options) {
    const item = document.createElement('option')
    item.value = option.value
    item.textContent = option.label
    item.selected = option.selected
    control.append(item)
  }

  label.append(name, control)
  if (field.errors.length > 0) {
    const error = document.createElement('small')
    error.textContent = field.errors
      .map((message) => message.replace(/^Homeworld /, ''))
      .join(', ')
    label.append(error)
  }
  return label
}

import {effect, type ReadonlySignal, registerDisposer} from './reactive'

interface ElProps {
  class?: string
  classList?: Record<string, boolean>
  text?: string
  html?: string
  style?: Partial<CSSStyleDeclaration>
  disabled?: boolean
  title?: string
  data?: Record<string, string>
  onClick?: (event: MouseEvent) => void
  onKeydown?: (event: KeyboardEvent) => void
  onInput?: (event: Event) => void
  onChange?: (event: Event) => void
}

type Child = HTMLElement | string

export const el = (
  tag: string,
  props?: ElProps,
  ...children: Child[]
): HTMLElement => {
  const element = document.createElement(tag)

  if (props) {
    if (props.class) element.className = props.class

    if (props.classList) {
      for (const [className, enabled] of Object.entries(props.classList)) {
        element.classList.toggle(className, enabled)
      }
    }

    if (props.text) element.textContent = props.text
    if (props.html) setTrustedHTML(element, props.html)
    if (props.style) Object.assign(element.style, props.style)
    if (props.disabled != null) {
      const button = element as HTMLButtonElement
      button.disabled = props.disabled
    }
    if (props.title) element.title = props.title

    if (props.data) {
      for (const [key, value] of Object.entries(props.data)) {
        element.dataset[key] = value
      }
    }

    if (props.onClick) {
      listen(element, 'click', props.onClick as EventListener)
    }
    if (props.onKeydown) {
      listen(element, 'keydown', props.onKeydown as EventListener)
    }
    if (props.onInput) {
      listen(element, 'input', props.onInput as EventListener)
    }
    if (props.onChange) {
      listen(element, 'change', props.onChange as EventListener)
    }
  }

  for (const child of children) {
    element.appendChild(
      typeof child === 'string' ? document.createTextNode(child) : child
    )
  }

  return element
}

export const setTrustedHTML = (element: HTMLElement, html: string): void => {
  element.innerHTML = html
}

export const clearHTML = (element: HTMLElement): void => {
  element.innerHTML = ''
}

export const listen = <T extends EventTarget, K extends string>(
  target: T,
  event: K,
  handler: (event: Event) => void,
  options?: AddEventListenerOptions
): (() => void) => {
  target.addEventListener(event, handler, options)

  const dispose = (): void => {
    target.removeEventListener(event, handler, options)
  }

  registerDisposer(dispose)

  return dispose
}

export const renderList = <T>(
  container: HTMLElement,
  items: readonly T[],
  renderItem: (item: T, index: number) => HTMLElement
): void => {
  clearHTML(container)

  for (let index = 0; index < items.length; index++) {
    container.appendChild(renderItem(items[index], index))
  }
}

export const hide = (element: HTMLElement): void => {
  element.setAttribute('hidden', '')
  element.style.display = ''
}

export const show = (element: HTMLElement, display = ''): void => {
  element.removeAttribute('hidden')
  element.removeAttribute('aria-hidden')
  element.style.display = display
}

export const visible = (
  element: HTMLElement,
  condition: boolean | ReadonlySignal<boolean>,
  display = ''
): void => {
  const apply = (enabled: boolean): void => {
    if (enabled) {
      element.removeAttribute('hidden')
      element.removeAttribute('aria-hidden')
      element.style.display = display
      return
    }

    element.setAttribute('hidden', '')
    element.setAttribute('aria-hidden', 'true')
    element.style.display = ''
  }

  if (typeof condition === 'boolean') {
    apply(condition)
    return
  }

  effect(() => {
    apply(condition.value)
  })
}

export const text = (
  element: HTMLElement,
  value: unknown | ReadonlySignal<unknown>
): void => {
  if (isSignal(value)) {
    effect(() => {
      element.textContent = String(value.value)
    })
    return
  }

  element.textContent = String(value)
}

export const cls = (
  element: HTMLElement,
  className: string,
  condition: boolean | ReadonlySignal<boolean>
): void => {
  if (typeof condition === 'boolean') {
    element.classList.toggle(className, condition)
    return
  }

  effect(() => {
    element.classList.toggle(className, condition.value)
  })
}

export const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const element = document.getElementById(id)

  if (!element) {
    throw new Error(`Element #${id} not found`)
  }

  return element as T
}

const isSignal = (value: unknown): value is ReadonlySignal<unknown> =>
  typeof value === 'object' && value !== null && 'value' in value

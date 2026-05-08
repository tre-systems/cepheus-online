export type TestListener = (event: { preventDefault: () => void }) => void

export class TestClassList {
  private readonly classes = new Set<string>()

  add(name: string) {
    this.classes.add(name)
  }

  toggle(name: string, force?: boolean) {
    const include = force ?? !this.classes.has(name)
    if (include) this.classes.add(name)
    else this.classes.delete(name)
    return include
  }

  contains(name: string) {
    return this.classes.has(name)
  }
}

export class TestNode {
  tagName: string
  className = ''
  classList = new TestClassList()
  dataset: Record<string, string> = {}
  textContent = ''
  type = ''
  title = ''
  value = ''
  selected = false
  disabled = false
  autocomplete = ''
  inputMode = ''
  rows = 0
  children: TestNode[] = []
  listeners: Record<string, TestListener[]> = {}

  constructor(tagName: string) {
    this.tagName = tagName
  }

  get childElementCount() {
    return this.children.length
  }

  append(...children: TestNode[]) {
    this.children.push(...children)
  }

  prepend(...children: TestNode[]) {
    this.children.unshift(...children)
  }

  replaceChildren(...children: TestNode[]) {
    this.children = children
  }

  setAttribute(name: string, value: string) {
    this.dataset[`attr:${name}`] = value
  }

  addEventListener(type: string, listener: TestListener) {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener({ preventDefault: () => {} })
    }
  }
}

export class TestDocument {
  createElement(tagName: string) {
    return new TestNode(tagName)
  }

  createDocumentFragment() {
    return new TestNode('#fragment')
  }
}

export const testDocument = new TestDocument()

export const asNode = (value: HTMLElement | DocumentFragment): TestNode =>
  value as unknown as TestNode

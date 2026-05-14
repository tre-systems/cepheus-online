export const bindAsyncActionButton = (
  button: HTMLButtonElement,
  callback: () => Promise<void> | void
): void => {
  let active = false
  const run = (event: Event) => {
    event.preventDefault()
    if (active) return
    active = true
    const priorDisabled = button.disabled
    button.disabled = true
    Promise.resolve(callback()).finally(() => {
      active = false
      button.disabled = priorDisabled
    })
  }

  button.addEventListener('pointerdown', run)
  button.addEventListener('click', run)
}

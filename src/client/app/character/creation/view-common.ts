export const plural = (
  count: number,
  singular: string,
  pluralText: string
): string => `${count} ${count === 1 ? singular : pluralText}`

import type { CharacterCharacteristics } from '../state'
import { evaluateCareerCheck } from './career-rules'
import type { AnagathicsPayment, AnagathicsUse, CareerRank, CareerTerm, CareerTermStart, ReenlistmentResolution } from './types'

const cloneCareerTerm = (term: CareerTerm): CareerTerm => ({
  ...term,
  skills: [...term.skills],
  skillsAndTraining: [...term.skillsAndTraining],
  benefits: [...term.benefits]
})

export const createCareerTerm = ({
  career,
  completedBasicTraining = false,
  drafted = false
}: {
  career: string
  completedBasicTraining?: boolean
  drafted?: boolean
}): CareerTerm => ({
  career,
  skills: [],
  skillsAndTraining: [],
  benefits: [],
  complete: false,
  canReenlist: true,
  completedBasicTraining,
  musteringOut: false,
  anagathics: false,
  ...(drafted ? { draft: 1 as const } : {})
})

export const startCareerTerm = ({
  career,
  terms,
  careers,
  drafted = false
}: {
  career: string
  terms: readonly CareerTerm[]
  careers: readonly CareerRank[]
  drafted?: boolean
}): CareerTermStart => {
  const completedBasicTraining = terms.some((term) => term.career === career)
  const nextTerms = terms.map((term, index) =>
    index === terms.length - 1 ? { ...cloneCareerTerm(term), complete: true } : cloneCareerTerm(term)
  )

  const hasCareer = careers.some((entry) => entry.name === career)
  const nextCareers = hasCareer
    ? careers.map((entry) => ({ ...entry }))
    : [...careers.map((entry) => ({ ...entry })), { name: career, rank: 0 }]

  return {
    terms: [
      ...nextTerms,
      createCareerTerm({ career, completedBasicTraining, drafted })
    ],
    careers: nextCareers,
    canEnterDraft: !drafted,
    failedToQualify: false
  }
}

export const leaveCareerTerm = (term: CareerTerm): CareerTerm => ({
  ...cloneCareerTerm(term),
  musteringOut: true,
  canReenlist: false,
  complete: true
})

export const mustResolveAging = ({
  age,
  termCount
}: {
  age: number | null | undefined
  termCount: number
}): boolean => (age ?? 0) < 18 + termCount * 4

export const deriveAnagathicsModifier = (
  terms: readonly Pick<CareerTerm, 'anagathics'>[]
): number =>
  terms.reduce((total, term) => total + (term.anagathics ? 1 : 0), 0)

export const deriveAgingRollModifier = (
  terms: readonly Pick<CareerTerm, 'anagathics'>[]
): number => deriveAnagathicsModifier(terms) - terms.length

export const payForAnagathics = ({
  credits,
  terms,
  cost
}: {
  credits: number
  terms: readonly CareerTerm[]
  cost: number
}): AnagathicsPayment => {
  const nextTerms = terms.map(cloneCareerTerm)
  if (nextTerms.length > 0) {
    nextTerms[nextTerms.length - 1] = {
      ...nextTerms[nextTerms.length - 1],
      anagathicsCost: cost
    }
  }

  return {
    credits: credits - cost,
    terms: nextTerms
  }
}

export const resolveAnagathicsUse = ({
  term,
  survived
}: {
  term: CareerTerm
  survived: boolean
}): AnagathicsUse => ({
  term: {
    ...cloneCareerTerm(term),
    anagathics: survived
  },
  survived
})

export const canOfferAnagathics = ({
  noOutstandingSelections = true,
  term,
  hasCareerBasics = true
}: {
  noOutstandingSelections?: boolean
  term: CareerTerm | null | undefined
  hasCareerBasics?: boolean
}): boolean =>
  noOutstandingSelections &&
  !!term &&
  hasCareerBasics &&
  term.survival === undefined &&
  !term.anagathics

export const canOfferReenlistment = ({
  noOutstandingSelections = true,
  term,
  mustAge = false
}: {
  noOutstandingSelections?: boolean
  term: CareerTerm | null | undefined
  mustAge?: boolean
}): boolean =>
  noOutstandingSelections &&
  !!term &&
  term.skillsAndTraining.length > 0 &&
  !mustAge &&
  term.reEnlistment === undefined

export const canOfferMusteringBenefit = ({
  noOutstandingSelections = true,
  remainingBenefits
}: {
  noOutstandingSelections?: boolean
  remainingBenefits: number
}): boolean => noOutstandingSelections && remainingBenefits > 0

export const canOfferNewCareer = ({
  noOutstandingSelections = true,
  termCount,
  remainingBenefits
}: {
  noOutstandingSelections?: boolean
  termCount: number
  remainingBenefits: number
}): boolean => noOutstandingSelections && termCount < 7 && remainingBenefits === 0

export const canCompleteCreation = ({
  noOutstandingSelections = true,
  terms
}: {
  noOutstandingSelections?: boolean
  terms: readonly CareerTerm[]
}): boolean =>
  noOutstandingSelections &&
  terms.length > 0 &&
  terms[terms.length - 1]?.complete === true

export const canStartNextCareerTerm = ({
  termCount,
  term,
  noOutstandingSelections = true
}: {
  termCount: number
  term: CareerTerm | null | undefined
  noOutstandingSelections?: boolean
}): boolean =>
  noOutstandingSelections &&
  termCount < 7 &&
  !!term?.canReenlist &&
  !term.musteringOut &&
  term.career !== 'Drifter'

export const resolveReenlistment = ({
  term,
  termCount,
  roll,
  check,
  characteristics
}: {
  term: CareerTerm
  termCount: number
  roll: number
  check: string
  characteristics: Partial<CharacterCharacteristics>
}): ReenlistmentResolution => {
  if (termCount >= 7) {
    return {
      outcome: 'retire',
      message: 'Your character must retire.',
      term: leaveCareerTerm(term),
      nextTermCareer: null
    }
  }

  if (roll === 12) {
    return {
      outcome: 'forced',
      message: 'Your character must reenlist.',
      term: cloneCareerTerm(term),
      nextTermCareer: term.career
    }
  }

  const result = evaluateCareerCheck({
    check,
    characteristics,
    roll
  })

  if (result?.success) {
    return {
      outcome: 'allowed',
      message: 'Your character may reenlist.',
      term: {
        ...cloneCareerTerm(term),
        canReenlist: true,
        reEnlistment: roll
      },
      nextTermCareer: null
    }
  }

  return {
    outcome: 'blocked',
    message: 'Your character may not reenlist.',
    term: leaveCareerTerm(term),
    nextTermCareer: null
  }
}

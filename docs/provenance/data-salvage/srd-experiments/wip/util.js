const {writeFileSync} = require('fs')
const {
  careerBasicsRaw,
  ranksAndSkillsRaw,
  materialBenefitsRaw,
  cashBenefitsRaw,
  personalDevelopmentRaw,
  serviceSkillsRaw,
  specialistSkillsRaw,
  advEducationRaw
} = require('./careersRaw')

const reduceTable = (primaryKey, rawData) => {
  const table = rawData.reduce(
    (acc, c) =>
      Object.keys(c).reduce((a, k) => {
        if (k !== primaryKey) {
          a[k] = {
            ...a[k],
            [c[primaryKey]]: c[k]
          }
        }
        return a
      }, acc),
    {}
  )

  console.log(primaryKey, Object.keys(table).length)

  return table
}

const outputCareers = () => {
  const careersFile = {
    careerBasics: reduceTable('Career', careerBasicsRaw),
    ranksAndSkills: reduceTable('Ranks and Skills', ranksAndSkillsRaw),
    materialBenefits: reduceTable('Material Benefits', materialBenefitsRaw),
    cashBenefits: reduceTable('Cash Benefits', cashBenefitsRaw),
    personalDevelopment: reduceTable(
      'Personal Development',
      personalDevelopmentRaw
    ),
    serviceSkills: reduceTable('Service Skills', serviceSkillsRaw),
    specialistSkills: reduceTable('Specialist', specialistSkillsRaw),
    advEducation: reduceTable('Adv Education', advEducationRaw)
  }

  writeFileSync('career.json', `${JSON.stringify(careersFile, null, '    ')}\n`)
}

console.log('OUTPUT_CAREERS')
outputCareers()

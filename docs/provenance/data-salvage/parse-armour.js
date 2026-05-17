const {readFileSync, writeFileSync} = require('fs')
const {join} = require('path')
const {startCase, toLower} = require('lodash')

const weaponsFile = join(__dirname, 'csc_armor.txt')
const outFile = join(__dirname, 'csc_armour.json')

const parseWeapons = async () => {
  const fileContents = readFileSync(weaponsFile, 'utf8')

  const lines = fileContents.split('\n')

  const items = []

  let current
  let Description = ''
  let stats

  // Collect list of types
  lines.forEach(line => {
    const nameMatch = line.match(/^\d\d\/\d\d\d\d\d ([A-Z- ]+)/)
    if (nameMatch) {
      if (current) {
        items.push(current)
      }
      current = {Name: startCase(toLower(nameMatch[1]))}
      Description = ''
      return
    }
    if (current) {
      const headingsMatch = line.match(
        /^Armour Type Protection TL Rad Kg Cost Required Skill/
      )

      if (headingsMatch) {
        current = {...current, Description}
        Description = ''
        stats = 'ARMOR'
        return
      }

      if (['ARMOR'].includes(stats)) {
        const stat = line.match(
          /^([^+]+)([^\s]+) ([^\s]+) ([^\s]+) ([^\s]+) ([^\s]+)(.*)/
        )
        if (!stat) {
          return
        }
        // Armour Type Protection TL Rad Kg Cost Required Skill

        current = {
          ...current,
          Category: 'ARMOR',
          Protection: Number(stat[2]),
          TL: Number(stat[3]),
          Rad: Number(stat[4]),
          Cost: Number(stat[6].replace('Cr', '')),
          Wgt: Number(stat[5]),
          Skill: stat[7]?.trim()
        }
        stats = null
      } else {
        Description += line.replace('\r', ' ')
      }
    }
  })

  writeFileSync(outFile, JSON.stringify(items, null, 2))
}

console.log('PARSING ARMOUR')

parseWeapons().then(() => console.log('DONE\n'))

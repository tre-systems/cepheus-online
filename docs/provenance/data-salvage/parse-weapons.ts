import {readFileSync, writeFileSync} from 'fs'
import {join} from 'path'
import {startCase, toLower} from 'lodash'

interface WeaponTraits {
  AP?: number
  Blast?: number
  Auto?: number
  Track?: boolean
  Scope?: boolean
  Radiation?: boolean
  Artillery?: boolean
  Bulky?: boolean
  VeryBulky?: boolean
  Smart?: boolean
  OneShot?: boolean
  Stun?: boolean
  Fire?: boolean
  ZeroG?: boolean
  Dangerous?: boolean
  Silent?: boolean
}

interface Weapon {
  Name: string
  Description?: string
  Category: string
  TL: number
  Cost: number
  Wgt: number
  Range: number
  Dmg: string
  Magazine?: number
  MagazineCost?: number
  Traits: WeaponTraits | string
}

const weaponsFile = join(__dirname, 'csc_ranged.txt')
const outFile = join(__dirname, 'csc_ranged.json')

const parseWeapons = async (): Promise<void> => {
  const weaponFileContents = readFileSync(weaponsFile, 'utf8')

  const lines = weaponFileContents.split('\n')

  const weapons: Weapon[] = []

  let currentWeapon: Partial<Weapon> | null = null
  let Description = ''
  let stats: string | null = null

  lines.forEach(line => {
    const nameMatch = line.match(/^\d\d\/\d\d\d\d\d ([A-Z- ]+)/)
    if (nameMatch) {
      if (currentWeapon) {
        weapons.push(currentWeapon as Weapon)
      }
      currentWeapon = {Name: startCase(toLower(nameMatch[1]))}
      Description = ''
      return
    }
    if (currentWeapon) {
      const rangedHeadingsMatch = line.match(
        /^Weapon TL Range Damage Kg Cost Magazine Magazine Cost Traits/
      )

      if (rangedHeadingsMatch) {
        currentWeapon = {...currentWeapon, Description}
        Description = ''
        stats = 'RANGED'
        return
      }

      const artilleryHeadingsMatch = line.match(
        /^Weapon TL Range Damage Tons Cost Magazine Magazine Cost Traits/
      )

      if (artilleryHeadingsMatch) {
        currentWeapon = {...currentWeapon, Description}
        Description = ''
        stats = 'ARTILLERY'
        return
      }

      const energyHeadingsMatch = line.match(
        /^Weapon TL Range Damage Kg Cost Magazine Power Pack Cost Traits/
      )

      if (energyHeadingsMatch) {
        currentWeapon = {...currentWeapon, Description}
        Description = ''
        stats = 'ENERGY'
        return
      }

      const grenadeHeadingsMatch = line.match(
        /^Weapon TL Range Damage Kg Cost Traits/
      )

      if (grenadeHeadingsMatch) {
        currentWeapon = {...currentWeapon, Description}
        Description = ''
        stats = 'GRENADE'
        return
      }

      if (['RANGED', 'ARTILLERY', 'ENERGY'].includes(stats || '')) {
        const stat = line.match(
          /^([a-zA-Z-' ]+)(\d+) ([\d.-]+) ([^\s]+) ([\d.-]+) ([^\s]+) ([^\s]+) ([^\s]+)(.*)/
        )
        if (!stat) {
          return
        }

        const traits = stat[9]
          ?.trim()
          ?.split(',')
          .map(i => i.trim())

        const getTraitValue = (name: string): number | undefined => {
          const value = traits?.find(i => i.startsWith(name))?.split(' ')?.[1]
          return value ? Number(value) : undefined
        }

        const getTrait = (name: string): boolean | undefined =>
          traits?.find(i => i.startsWith(name)) ? true : undefined

        currentWeapon = {
          ...currentWeapon,
          Category: 'RANGED_WEAPON',
          TL: Number(stat[2]),
          Cost: Number(stat[6].replace('Cr', '')),
          Wgt:
            stat[5] === '-'
              ? 0
              : Number(
                  stats === 'ARTILLERY' ? Number(stat[5]) * 1000 : stat[5]
                ),
          Range: Number(
            stats === 'ARTILLERY' ? Number(stat[3]) * 1000 : stat[3]
          ),
          Dmg: stat[4],
          Magazine: Number(stat[7]),
          MagazineCost: Number(stat[8].replace('Cr', '')),
          Traits: {
            AP: getTraitValue('AP'),
            Blast: getTraitValue('Blast'),
            Auto: getTraitValue('Auto'),
            Track: getTrait('Track'),
            Scope: getTrait('Scope'),
            Radiation: getTrait('Radiation'),
            Artillery: getTrait('Artillery'),
            Bulky: getTrait('Bulky'),
            VeryBulky: getTrait('Very Bulky'),
            Smart: getTrait('Smart'),
            OneShot: getTrait('One Shot'),
            Stun: getTrait('Stun'),
            Fire: getTrait('Fire'),
            ZeroG: getTrait('Zero-G'),
            Dangerous: getTrait('Dangerous'),
            Silent: getTrait('Silent')
          }
        }
        stats = null
      } else if (['GRENADE'].includes(stats || '')) {
        const stat = line.match(
          /^([a-zA-Z-' ]+)(\d+) ([\d.-]+) ([^\s]+) ([\d.-]+) ([^\s]+)(.*)/
        )
        if (!stat) {
          return
        }

        currentWeapon = {
          ...currentWeapon,
          Category: 'GRENADE',
          TL: Number(stat[2]),
          Cost: Number(stat[6].replace('Cr', '')),
          Wgt: stat[5] === '-' ? 0 : Number(stat[5]),
          Range: Number(stat[3]),
          Dmg: stat[4],
          Traits: stat[7].trim()
        }
        stats = null
      } else {
        Description += line.replace('\r', ' ')
      }
    }
  })

  if (currentWeapon) {
    weapons.push(currentWeapon as Weapon)
  }

  writeFileSync(outFile, JSON.stringify(weapons, null, 2))
}

console.log('PARSING WEAPONS')

parseWeapons().then(() => console.log('DONE\n'))

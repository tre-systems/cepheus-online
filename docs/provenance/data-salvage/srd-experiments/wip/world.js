const Size = Object.freeze([
  {Diameter: 800, SurfaceGravity: 0.01},
  {Diameter: 1600, SurfaceGravity: 0.05},
  {Diameter: 3200, SurfaceGravity: 0.15},
  {Diameter: 4800, SurfaceGravity: 0.25},
  {Diameter: 6400, SurfaceGravity: 0.35},
  {Diameter: 8000, SurfaceGravity: 0.45},
  {Diameter: 9600, SurfaceGravity: 0.7},
  {Diameter: 11200, SurfaceGravity: 0.9},
  {Diameter: 12800, SurfaceGravity: 1.0},
  {Diameter: 14400, SurfaceGravity: 1.25},
  {Diameter: 16000, SurfaceGravity: 1.4}
])

const Atmosphere = Object.freeze([
  {Type: [], Pressure: '0.00', SurvivalGearRequired: 'Vacc Suit'},
  {
    Type: ['Trace'],
    Pressure: '0.001 to 0.09',
    SurvivalGearRequired: 'Vacc Suit'
  },
  {
    Type: ['Very Thin', 'Tainted'],
    Pressure: '0.1 to 0.42',
    SurvivalGearRequired: 'Respirator, Filter'
  },
  {
    Type: ['Very Thin'],
    Pressure: '0.1 to 0.42',
    SurvivalGearRequired: 'Respirator'
  },
  {
    Type: ['Thin', 'Tainted'],
    Pressure: '0.43 to 0.7',
    SurvivalGearRequired: 'Filter'
  },
  {Type: ['Thin'], Pressure: '0.43 to 0.7', SurvivalGearRequired: ''},
  {Type: ['Standard'], Pressure: '0.71–1.49', SurvivalGearRequired: ''},
  {
    Type: ['Standard', 'Tainted'],
    Pressure: '0.71–1.49',
    SurvivalGearRequired: 'Filter'
  },
  {Type: ['Dense'], Pressure: '1.5 to 2.49', SurvivalGearRequired: ''},
  {
    Type: ['Dense', 'Tainted'],
    Pressure: '1.5 to 2.49',
    SurvivalGearRequired: 'Filter'
  },
  {Type: ['Exotic'], Pressure: 'Varies', SurvivalGearRequired: 'Air Supply'},
  {Type: ['Corrosive'], Pressure: 'Varies', SurvivalGearRequired: 'Vacc Suit'},
  {Type: ['Insidious'], Pressure: 'Varies', SurvivalGearRequired: 'Vacc Suit'},
  {Type: ['Dense, High'], Pressure: '2.5+', SurvivalGearRequired: ''},
  {Type: ['Thin, Low'], Pressure: '0.5 or less', SurvivalGearRequired: ''},
  {Type: ['Unusual'], Pressure: 'Varies', SurvivalGearRequired: 'Varies'}
])

const AtmosphereTypes = Object.freeze([
  {
    Type: 'Tainted',
    Description:
      'Tainted atmospheres contain some element that is harmful to humans, ' +
      'such as an unusually high proportion of carbon dioxide. ' +
      'A character who breathes a tainted atmosphere without a filter will ' +
      'suffer 1D6 damage every few minutes (or hours, depending on the level of taint).'
  },
  {
    Type: 'Exotic',
    Description:
      'An exotic atmosphere is unbreathable by humans, but is not otherwise hazardous. ' +
      'A character needs an air supply to breath in an exotic atmosphere.'
  },
  {
    Type: 'Corrosive',
    Description:
      'Corrosive atmospheres are highly dangerous. A character who breathes in ' +
      'a corrosive atmosphere will suffer 1D6 damage each round.'
  },
  {
    Type: 'Insidious',
    Description:
      'An insidious atmosphere is like a corrosive one, but it is so corrosive ' +
      'that it attacks equipment as well. The chief danger in an insidious ' +
      'atmosphere is that the toxic gases will destroy the seals and filters ' +
      "on the character's protective gear. An insidious atmosphere worms its " +
      'way past protection after 2D6 hours on average, although vigilant ' +
      'maintenance or advanced protective gear can prolong survival times.'
  },
  {
    Type: 'Dense, High',
    Description:
      'These worlds have thick N2/O2 atmospheres, but their mean surface ' +
      'pressure is too high to support unprotected human life (high pressure ' +
      'nitrogen and oxygen are deadly to humans). However, pressure naturally ' +
      'decreases with increasing altitude, so if there are highlands at the ' +
      'right altitude the pressure may drop enough to support human life. ' +
      'Alternatively, there may not be any topography high enough for humans ' +
      'to inhabit, necessitating floating gravitic or dirigible habitats or ' +
      'sealed habitats on the surface.'
  },
  {
    Type: 'Thin, Low',
    Description:
      'The opposite of the Dense, High atmosphere, these massive worlds have ' +
      'thin N2/O2 atmospheres that settle in the lowlands and depressions and ' +
      'are only breathable there – the pressure drops off so rapidly with ' +
      'altitude that the highest topographic points of the surface may be ' +
      'close to vacuum.'
  },
  {
    Type: 'Unusual',
    Description:
      'An Unusual atmosphere is a catchall term for an atmosphere that behaves ' +
      'in a strange manner. Examples include ellipsoidal atmospheres, ' +
      'which are thin at the poles and dense at the equator; Panthalassic ' +
      'worlds composed of a rocky core surrounded by a water layer hundreds ' +
      'of kilometers thick; worlds wracked by storms so intense that that ' +
      'the local air pressure changes from dense to thin depending on the ' +
      'current weather; and other planets with unusual and hazardous ' +
      'atmospheric conditions.'
  }
])

const Hydrographics = Object.freeze([
  [
    {Percentage: '0%–5%', Description: 'Desert world'},
    {Percentage: '6%–15%', Description: 'Dry world'},
    {Percentage: '16%–25%', Description: 'A few small seas.'},
    {Percentage: '26%–35%', Description: 'Small seas and oceans.'},
    {Percentage: '36%–45%', Description: 'Wet world'},
    {Percentage: '46%–55%', Description: 'Large oceans'},
    {Percentage: '56%–65%', Description: ''},
    {Percentage: '66%–75%', Description: 'Earth-like world'},
    {Percentage: '76%–85%', Description: 'Water world'},
    {
      Percentage: '86%–95%',
      Description: 'Only a few small islands and archipelagos.'
    },
    {Percentage: '96–100%', Description: 'Almost entirely water.'}
  ]
])

module.exports = {Size, Atmosphere, AtmosphereTypes, Hydrographics}

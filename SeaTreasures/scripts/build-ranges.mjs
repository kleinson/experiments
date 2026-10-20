/**
 * Builds data/ranges.json: where each species has been recorded, counted from
 * GBIF occurrence records inside named seas and famous islands, plus a world
 * map drawn from Natural Earth land (via world-atlas). It also writes one
 * sourced claim and one GBIF source per species into data/claims.json,
 * replacing its own earlier entries.
 *
 * Run: npm run ranges   (needs a network connection; takes about a minute)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { feature } from 'topojson-client'
import { geoEquirectangular, geoPath } from 'd3-geo'

const root = new URL('../data/', import.meta.url)
const today = new Date().toISOString().slice(0, 10)

/** Named seas and famous islands: [id, name, ocean, [west, south, east, north]]. */
const REGIONS = [
  ['red-sea', 'Red Sea', 'indian', [32, 12.5, 44, 30]],
  ['persian-gulf', 'Persian Gulf & Gulf of Oman', 'indian', [47, 22, 60, 30.5]],
  ['east-africa', 'East African coast & Zanzibar', 'indian', [32, -27, 42, -1]],
  ['madagascar', 'Madagascar', 'indian', [42.5, -26, 51, -11.5]],
  ['seychelles', 'Seychelles', 'indian', [45, -10.5, 57, -3.5]],
  ['mauritius', 'Mauritius & Réunion', 'indian', [55, -21.5, 58, -19.8]],
  ['maldives', 'Maldives', 'indian', [72.5, -1, 74, 7.2]],
  ['chagos', 'Chagos Archipelago', 'indian', [70.5, -8, 73, -4.5]],
  ['sri-lanka', 'Sri Lanka', 'indian', [79.4, 5.8, 82, 10]],
  ['andaman', 'Andaman Sea & Phuket', 'indian', [92, 5, 99, 14]],
  ['ningaloo', 'Ningaloo & Western Australia', 'indian', [112, -27, 115, -21]],
  [
    'bali-komodo',
    'Bali & Komodo',
    'coral-triangle',
    [114.3, -9.5, 120.5, -7.5],
  ],
  ['sulawesi', 'Sulawesi', 'coral-triangle', [118, -6, 126, 2]],
  ['ambon', 'Ambon & the Moluccas', 'coral-triangle', [126, -5, 132, 2]],
  ['philippines', 'Philippines', 'coral-triangle', [116.5, 4.5, 127, 21]],
  [
    'papua-new-guinea',
    'Papua New Guinea',
    'coral-triangle',
    [140, -12, 156, -1],
  ],
  [
    'solomon-islands',
    'Solomon Islands',
    'coral-triangle',
    [156, -12.5, 168, -5],
  ],
  [
    'okinawa',
    'Okinawa & Ryukyu Islands',
    'west-pacific',
    [122.5, 23.5, 131.5, 29.5],
  ],
  ['taiwan', 'Taiwan', 'west-pacific', [119, 21.5, 122.5, 25.5]],
  ['palau', 'Palau', 'west-pacific', [131, 2.5, 135, 8.5]],
  ['guam', 'Guam & Mariana Islands', 'west-pacific', [144, 12.5, 146.5, 21]],
  [
    'great-barrier-reef',
    'Great Barrier Reef',
    'west-pacific',
    [142, -24.5, 154, -10],
  ],
  ['new-caledonia', 'New Caledonia', 'west-pacific', [163, -23.5, 169, -19]],
  ['vanuatu', 'Vanuatu', 'west-pacific', [166, -21, 171, -13]],
  ['fiji', 'Fiji', 'central-pacific', [176.5, -21, 180, -15.5]],
  [
    'marshall-islands',
    'Marshall Islands',
    'central-pacific',
    [160, 4, 173, 15],
  ],
  [
    'samoa-tonga',
    'Samoa & Tonga',
    'central-pacific',
    [-176.5, -23.5, -168, -13],
  ],
  [
    'cook-islands',
    'Cook Islands',
    'central-pacific',
    [-166, -22.5, -157, -8.5],
  ],
  [
    'french-polynesia',
    'Tahiti & French Polynesia',
    'central-pacific',
    [-155, -28, -134, -7],
  ],
  [
    'hawaiian-islands',
    'Hawaiian Islands',
    'central-pacific',
    [-161, 18.5, -154.5, 23],
  ],
  [
    'rapa-nui',
    'Rapa Nui (Easter Island)',
    'east-pacific',
    [-109.8, -27.5, -108.8, -26.8],
  ],
  ['galapagos', 'Galápagos Islands', 'east-pacific', [-92.5, -1.6, -89, 1.8]],
  [
    'east-pacific-abyss',
    'Eastern Pacific abyss',
    'east-pacific',
    [-91, -20, -74, 14],
  ],
  [
    'gulf-of-california',
    'Gulf of California',
    'east-pacific',
    [-115, 22.5, -106, 31.8],
  ],
  ['florida-keys', 'Florida Keys', 'atlantic', [-82.5, 24.3, -80, 25.8]],
  ['bahamas', 'The Bahamas', 'atlantic', [-79.5, 20.8, -72.5, 27.3]],
  ['bermuda', 'Bermuda', 'atlantic', [-65.2, 32, -64.5, 32.6]],
  ['cuba', 'Cuba', 'atlantic', [-85.5, 19.5, -74, 23.5]],
  ['cayman-islands', 'Cayman Islands', 'atlantic', [-81.5, 19.2, -79.6, 19.8]],
  ['jamaica', 'Jamaica', 'atlantic', [-78.5, 17.5, -76, 18.6]],
  [
    'puerto-rico',
    'Puerto Rico & Virgin Islands',
    'atlantic',
    [-67.5, 17.6, -64.2, 18.8],
  ],
  [
    'lesser-antilles',
    'Lesser Antilles',
    'atlantic',
    [-63.5, 10.5, -59.3, 18.5],
  ],
  [
    'abc-islands',
    'Aruba, Bonaire & Curaçao',
    'atlantic',
    [-70.2, 11.9, -67.9, 12.7],
  ],
  ['mesoamerican-reef', 'Belize & Yucatán', 'atlantic', [-89, 15.5, -86, 21.7]],
  [
    'canary-islands',
    'Canary Islands',
    'east-atlantic',
    [-18.5, 27.5, -13, 29.5],
  ],
  ['cape-verde', 'Cape Verde', 'east-atlantic', [-25.5, 14.5, -22.5, 17.3]],
  ['mediterranean', 'Mediterranean Sea', 'east-atlantic', [-5.5, 30, 36.5, 46]],
]

const OCEANS = {
  indian: 'Indian Ocean & Red Sea',
  'coral-triangle': 'Coral Triangle',
  'west-pacific': 'Western Pacific',
  'central-pacific': 'Central & South Pacific',
  'east-pacific': 'Eastern Pacific',
  atlantic: 'Caribbean & Western Atlantic',
  'east-atlantic': 'Eastern Atlantic & Mediterranean',
}

/** Oceans each species is documented to live in, with the claim that says so; others are flagged. */
const NATIVE = {
  'tiger-cowrie': {
    oceans: ['indian', 'coral-triangle', 'west-pacific', 'central-pacific'],
    claim: 'tiger-cowrie-habitat',
  },
  'queen-conch': { oceans: ['atlantic'], claim: 'queen-conch-range-habitat' },
  'chambered-nautilus': {
    oceans: ['indian', 'coral-triangle', 'west-pacific', 'central-pacific'],
    claim: 'nautilus-range',
  },
  'giant-clam': {
    oceans: ['indian', 'coral-triangle', 'west-pacific', 'central-pacific'],
    claim: 'giant-clam-range-habitat',
  },
  'fuzzy-chiton': { oceans: ['atlantic'], claim: 'fuzzy-chiton-range-habitat' },
  'tusk-shell': {
    oceans: ['east-atlantic'],
    claim: 'tusk-shell-range-habitat',
  },
  monoplacophoran: { oceans: ['east-pacific'], claim: 'neopilina-range-depth' },
}

const SPECIES = {
  'tiger-cowrie': 'Cypraea tigris',
  'money-cowrie': 'Monetaria moneta',
  'textile-cone': 'Conus textile',
  'queen-conch': 'Aliger gigas',
  'chambered-nautilus': 'Nautilus pompilius',
  'giant-clam': 'Tridacna gigas',
  'fuzzy-chiton': 'Acanthopleura granulata',
  'tusk-shell': 'Antalis vulgaris',
  monoplacophoran: 'Neopilina galatheae',
}

/** Specimens and observations of living or dead animals; fossils and automated tag detections are left out. */
const BASIS = [
  'HUMAN_OBSERVATION',
  'PRESERVED_SPECIMEN',
  'MATERIAL_SAMPLE',
  'MATERIAL_CITATION',
  'OCCURRENCE',
  'OBSERVATION',
  'LIVING_SPECIMEN',
]
const OBSERVED = new Set([
  'HUMAN_OBSERVATION',
  'OBSERVATION',
  'LIVING_SPECIMEN',
])

const api = 'https://api.gbif.org/v1/'
async function get(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(api + path)
    if (response.ok) return response.json()
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
  }
  throw new Error(`GBIF request failed: ${path}`)
}

const polygon = ([w, s, e, n]) =>
  `POLYGON((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`
const filters = (taxonKey) =>
  `taxonKey=${taxonKey}&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&` +
  BASIS.map((basis) => `basisOfRecord=${basis}`).join('&')

async function count(taxonKey, bbox) {
  const geometry = bbox ? `&geometry=${encodeURIComponent(polygon(bbox))}` : ''
  const result = await get(
    `occurrence/search?${filters(taxonKey)}${geometry}&limit=0&facet=basisOfRecord&facetLimit=20`,
  )
  let observed = 0
  for (const entry of result.facets?.[0]?.counts ?? [])
    if (OBSERVED.has(entry.name)) observed += entry.count
  return { n: result.count, observed, specimens: result.count - observed }
}

async function inBatches(items, size, work) {
  const out = []
  for (let index = 0; index < items.length; index += size)
    out.push(...(await Promise.all(items.slice(index, index + size).map(work))))
  return out
}

// World map: Natural Earth land, equirectangular, centred on 150°E so the Indo-Pacific is unbroken.
const WIDTH = 1000
const projection = geoEquirectangular()
  .rotate([-150, 0])
  .scale(WIDTH / (2 * Math.PI))
  .translate([WIDTH / 2, WIDTH / 4])
const topology = JSON.parse(
  readFileSync(
    new URL('../node_modules/world-atlas/land-110m.json', import.meta.url),
    'utf8',
  ),
)
const land = geoPath(projection).digits(1)(
  feature(topology, topology.objects.land),
)
const project = ([lon, lat]) =>
  projection([lon, lat]).map((value) => Math.round(value * 10) / 10)
const viewBox = [
  0,
  Math.round(((90 - 55) / 360) * WIDTH),
  WIDTH,
  Math.round((110 / 360) * WIDTH),
]

const regions = REGIONS.map(([id, name, ocean, bbox]) => {
  const centre = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
  const corners = [project([bbox[0], bbox[3]]), project([bbox[2], bbox[1]])]
  return {
    id,
    name,
    ocean,
    bbox,
    at: project(centre),
    box: [
      ...corners[0],
      corners[1][0] - corners[0][0],
      corners[1][1] - corners[0][1],
    ],
  }
})

const manifest = JSON.parse(readFileSync(new URL('claims.json', root), 'utf8'))
const records = {}
for (const [speciesId, name] of Object.entries(SPECIES)) {
  const match = await get(
    `species/match?name=${encodeURIComponent(name)}&kingdom=Animalia`,
  )
  if (match.matchType !== 'EXACT' || match.status !== 'ACCEPTED')
    throw new Error(`${name} did not match exactly in GBIF`)
  const taxonKey = match.usageKey
  const total = await count(taxonKey)
  const counts = await inBatches(regions, 6, (region) =>
    count(taxonKey, region.bbox),
  )
  const byRegion = {}
  regions.forEach((region, index) => {
    if (counts[index].n > 0) byRegion[region.id] = counts[index]
  })
  const covered = Object.keys(byRegion).length
  records[speciesId] = {
    taxonKey,
    total,
    regions: byRegion,
    native: NATIVE[speciesId] ?? null,
  }

  const sourceId = `gbif-${speciesId}`
  const claimId = `${speciesId}-gbif-records`
  const query = `https://www.gbif.org/occurrence/search?taxon_key=${taxonKey}&has_coordinate=true&has_geospatial_issue=false&occurrence_status=present`
  manifest.sources = manifest.sources.filter((source) => source.id !== sourceId)
  manifest.claims = manifest.claims.filter((claim) => claim.id !== claimId)
  manifest.sources.push({
    id: sourceId,
    title: `GBIF occurrence records: ${name} (taxon key ${taxonKey})`,
    publisher: 'GBIF.org (Global Biodiversity Information Facility)',
    url: query,
    accessedAt: today,
    kind: 'biodiversity-database',
    accessNote: `Counted through the GBIF occurrence API on ${today}: records with coordinates, no geospatial issue, occurrence status present, and basis of record one of ${BASIS.join(', ')}. Synonyms are included by GBIF. Each record keeps the licence of its dataset.`,
  })
  manifest.claims.push({
    id: claimId,
    text: `GBIF holds ${total.n.toLocaleString('en-US')} located records of ${name}: museum specimens and observations, leaving out fossils and automated tag detections. ${covered} of the ${regions.length} seas and islands shown here have at least one record.`,
    sourceIds: [sourceId],
    scope: 'species',
    confidence: 'high',
    evidenceNote:
      'The counts are facts about the database, not about the ocean. More records usually means more divers, collectors and surveys, not more animals; old museum labels can be imprecise; and empty shells can be recorded far from where the animal lived. A region with no records may simply be unsurveyed. Region outlines are simple boxes drawn for this simulator.',
  })
  console.log(`${speciesId}: ${total.n} records, ${covered} regions`)
}

writeFileSync(
  new URL('ranges.json', root),
  JSON.stringify(
    {
      accessedAt: today,
      basis: BASIS,
      oceans: OCEANS,
      map: { width: WIDTH, viewBox, land, centre: 150 },
      regions,
      records,
    },
    null,
    2,
  ) + '\n',
)
writeFileSync(
  new URL('claims.json', root),
  JSON.stringify(manifest, null, 2) + '\n',
)
console.log(
  `Wrote ranges.json (${(land.length / 1024).toFixed(0)} KB of coastline) and updated claims.json`,
)

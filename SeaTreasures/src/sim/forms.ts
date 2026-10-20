import type { Species } from './species.ts'

/**
 * Local forms: where the sources describe a population that differs by place,
 * the species is shown as that form there. Only sourced differences change:
 * the Hawaiian tiger cowrie gets its own name and size, not a new pattern,
 * because the sources say pattern alone does not tell the forms apart
 * (demo-no-visual-species-discrimination).
 */
type Form = {
  places: string[]
  change: (species: Species) => Species
  /** One line for the shell menu and title. */
  note: string
  claim: string
}

const forms: Record<string, Form[]> = {
  'tiger-cowrie': [
    {
      places: ['hawaiian-islands'],
      note: 'Hawaii has its own subspecies: larger, about 100 mm on average and up to about 153 mm',
      claim: 'size-reference-schilderiana',
      change: (species) => ({
        ...species,
        commonName: 'Hawaiian tiger cowrie',
        scientificName: 'Cypraea tigris schilderiana',
        authority: 'C. N. Cate, 1961',
        taxonClaim: 'taxonomy-accepted-subspecies',
        lengthMm: {
          typical: null,
          max: 153,
          drawn: 100,
          claim: 'size-reference-schilderiana',
        },
        drawnNote:
          'Drawn at the reported average for the Hawaiian subspecies; specimens over about 125 mm are rare.',
      }),
    },
  ],
}

/** The species as it is found at a place: its local form if the sources describe one. */
export function localForm(species: Species, regionId: string) {
  const form = forms[species.id]?.find((item) => item.places.includes(regionId))
  return form
    ? { species: form.change(species), note: form.note, claim: form.claim }
    : { species, note: null, claim: null }
}

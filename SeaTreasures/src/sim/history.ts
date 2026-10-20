export type HistoryCard = {
  title: string
  what: string
  why: string
  how: string
  source: string
  href: string
}

export const historyCards: HistoryCard[] = [
  {
    title: 'Adornment',
    what: 'Shells became beads, pendants, buttons and clothing decoration.',
    why: 'Their durable surfaces, natural holes and luminous colours made them portable signs of identity and status.',
    how: 'People drilled, pierced, polished and strung shells; the exact meaning depended on the community and period.',
    source: 'Smithsonian collections: shell ornament',
    href: 'https://www.si.edu/search?edan_q=shell%20ornament',
  },
  {
    title: 'Trade & money',
    what: 'Cowries were used as money and counted wealth in parts of Africa and Asia.',
    why: 'A small, recognisable shell was durable, divisible and difficult to counterfeit locally.',
    how: 'Shells moved through long-distance trade networks and were measured in strings, bags or counts.',
    source: 'British Museum: cowrie shell collections',
    href: 'https://www.britishmuseum.org/collection/search?keyword=cowrie%20shell',
  },
  {
    title: 'Sound & ceremony',
    what: 'Large conchs were made into trumpets and ceremonial objects.',
    why: 'A cut aperture turns the shell into a resonant wind instrument and a striking ritual object.',
    how: 'Makers opened or drilled the shell, then blew across the opening; uses were cultural, not universal.',
    source: 'Smithsonian collections: conch trumpets',
    href: 'https://www.si.edu/search?edan_q=conch%20trumpet',
  },
  {
    title: 'Medicine & belief',
    what: 'Shell powder, amulets and preparations appear in historical medical and protective practices.',
    why: 'These records show what people believed or practised, not that shell remedies were effective.',
    how: 'Shells were worn, ground or mixed into preparations in particular traditions; modern treatment should rely on clinical evidence.',
    source: 'Wellcome Collection: shell remedies and amulets',
    href: 'https://wellcomecollection.org/works?query=shell%20medicine',
  },
]

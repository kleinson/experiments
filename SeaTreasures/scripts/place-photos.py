#!/usr/bin/env python3
"""
Matches each place's water and sand to real underwater photographs.

  python3 scripts/place-photos.py fetch [region ...]   # Wikimedia Commons search, into .cache/
  python3 scripts/place-photos.py analyse              # writes data/place-colours.json

`fetch` searches Wikimedia Commons for underwater photos of every place and
downloads small thumbnails into .cache/place-photos (not committed). Photos
listed in data/research/place-photo-exclusions.json (boats, satellite views,
aquariums, above-water shots) are skipped. `analyse` keeps photos lit by the
water itself (blue-green ahead of red, no flash or room light), takes the
median colour of the open water in the top of each frame and of pale sand
near the bottom, and writes per-place targets with the photos they came from
(title, author, licence, page), so every colour can be traced. Only colour
statistics are kept: no photo is copied into the project. Needs Pillow.
"""
import sys
import json, re, os, time, urllib.parse, urllib.request, urllib.error
UA = {'User-Agent': 'SeaTreasures-research/1.0 (open-source education project; kleinson)'}
Q = {
 'red-sea': ['underwater Red Sea reef', 'Red Sea coral reef Egypt underwater', 'Dahab underwater', 'Eilat coral reef underwater'],
 'persian-gulf': ['Persian Gulf coral reef', 'Oman underwater reef', 'Musandam underwater', 'Daymaniyat underwater', 'Qatar coral reef underwater', 'Kish Island underwater'],
 'east-africa': ['Zanzibar coral reef', 'Mnemba underwater', 'Kenya coral reef fish', 'Watamu underwater', 'Mozambique coral reef', 'Tanzania coral reef underwater', 'Pemba Island underwater'],
 'madagascar': ['Madagascar underwater', 'Nosy Be coral reef', 'Madagascar coral reef fish', 'Nosy Tanikely underwater'],
 'seychelles': ['underwater Seychelles reef', 'Seychelles coral reef diving'],
 'mauritius': ['Mauritius underwater', 'Mauritius coral reef fish', 'Réunion coral reef underwater', 'Blue Bay Mauritius'],
 'maldives': ['underwater Maldives reef', 'Maldives coral reef diving'],
 'chagos': ['Chagos', 'British Indian Ocean Territory underwater', 'Diego Garcia underwater', 'Diego Garcia coral'],
 'sri-lanka': ['Sri Lanka underwater', 'Hikkaduwa underwater', 'Trincomalee underwater', 'Pigeon Island Sri Lanka coral'],
 'andaman': ['underwater Similan Islands', 'Andaman Sea underwater reef', 'Phuket underwater'],
 'ningaloo': ['Ningaloo underwater', 'Ningaloo coral', 'Coral Bay Western Australia underwater', 'Exmouth underwater'],
 'bali-komodo': ['underwater Bali reef', 'Komodo underwater reef'],
 'sulawesi': ['underwater Sulawesi reef', 'Bunaken underwater', 'Wakatobi underwater'],
 'ambon': ['Ambon underwater', 'Raja Ampat underwater reef', 'Moluccas underwater coral'],
 'philippines': ['underwater Philippines coral reef', 'Tubbataha underwater', 'Anilao underwater'],
 'papua-new-guinea': ['Papua New Guinea coral reef', 'Kimbe Bay underwater', 'Milne Bay underwater', 'Madang underwater', 'New Britain coral reef'],
 'solomon-islands': ['Solomon Islands coral reef fish', 'Solomon Islands underwater coral', 'Marovo Lagoon underwater', 'Gizo underwater'],
 'okinawa': ['underwater Okinawa reef', 'Kerama Islands underwater'],
 'taiwan': ['Taiwan underwater coral', 'Kenting underwater', 'Green Island Taiwan underwater'],
 'palau': ['underwater Palau reef', 'Palau coral reef diving'],
 'guam': ['underwater Guam reef', 'Saipan underwater', 'Mariana Islands coral reef'],
 'great-barrier-reef': ['Great Barrier Reef underwater', 'Great Barrier Reef coral diving'],
 'new-caledonia': ['New Caledonia coral reef underwater', 'Noumea underwater', 'New Caledonia lagoon underwater fish'],
 'vanuatu': ['Vanuatu coral reef', 'Espiritu Santo underwater', 'Vanuatu underwater fish', 'Million Dollar Point underwater'],
 'fiji': ['underwater Fiji reef', 'Fiji coral reef diving'],
 'marshall-islands': ['Marshall Islands underwater', 'Kwajalein underwater', 'Majuro underwater', 'Bikini Atoll coral'],
 'samoa-tonga': ['American Samoa underwater reef', 'Tonga underwater reef', 'Samoa coral reef'],
 'cook-islands': ['Cook Islands underwater', 'Rarotonga underwater', 'Aitutaki lagoon underwater'],
 'french-polynesia': ['French Polynesia underwater', 'Moorea underwater reef', 'Tahiti underwater coral', 'Rangiroa underwater'],
 'hawaiian-islands': ['underwater Hawaii reef', 'Hawaii coral reef snorkeling', 'Papahanaumokuakea underwater reef'],
 'rapa-nui': ['Easter Island underwater', 'Rapa Nui underwater', 'Motu Nui underwater', 'Salas y Gomez underwater'],
 'galapagos': ['Galapagos underwater', 'Galapagos reef underwater'],
 'gulf-of-california': ['Gulf of California underwater', 'Sea of Cortez underwater', 'Cabo Pulmo underwater', 'Espiritu Santo Baja underwater', 'Loreto underwater'],
 'florida-keys': ['Florida Keys coral reef', 'Key Largo underwater', 'Looe Key reef', 'Dry Tortugas underwater', 'Florida Keys seagrass underwater'],
 'bahamas': ['Bahamas coral reef underwater', 'Exuma underwater', 'Bahamas underwater fish', 'Bimini underwater', 'Eleuthera underwater', 'Bahamas turtle grass'],
 'bermuda': ['Bermuda coral reef underwater', 'Bermuda underwater fish', 'Bermuda reef snorkel'],
 'cuba': ['Cuba underwater reef', 'Jardines de la Reina underwater'],
 'cayman-islands': ['Cayman underwater', 'Grand Cayman reef', 'Cayman Brac underwater', 'Little Cayman reef', 'Stingray City'],
 'jamaica': ['Jamaica coral reef underwater', 'Montego Bay underwater', 'Negril underwater', 'Discovery Bay Jamaica coral'],
 'puerto-rico': ['Puerto Rico underwater reef', 'Virgin Islands underwater reef'],
 'lesser-antilles': ['Saint Lucia underwater reef', 'Dominica underwater', 'Guadeloupe underwater', 'Barbados underwater reef'],
 'abc-islands': ['Bonaire underwater reef', 'Curaçao underwater reef', 'Aruba underwater'],
 'mesoamerican-reef': ['Belize underwater reef', 'Cozumel underwater', 'Mesoamerican reef underwater'],
 'canary-islands': ['Canary Islands underwater', 'Tenerife underwater', 'Lanzarote underwater'],
 'cape-verde': ['Cape Verde underwater', 'Cabo Verde underwater'],
 'mediterranean': ['Posidonia oceanica underwater', 'Mediterranean seagrass meadow underwater', 'Mediterranean underwater rocks fish', 'Mallorca underwater', 'Port-Cros underwater', 'Corsica underwater', 'Malta underwater', 'Croatia underwater'],
}
BAD = re.compile(r'map|logo|diagram|chart|aquarium|museum|stamp|drawing|illustration|painting|satellite|aerial|beach|hotel|boat|ship|island from|sunset|resort|market|skeleton|specimen|fossil|\.svg|\.png|\.gif|\.tif', re.I)
def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params)
    for wait in (0, 10, 30, 60):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
    raise RuntimeError('rate limited')
def search(q):
    data = api({'action':'query','format':'json','generator':'search','gsrnamespace':6,
                'gsrsearch': q + ' filetype:bitmap','gsrlimit':40,'prop':'imageinfo',
                'iiprop':'url|extmetadata|size|mime','iiurlwidth':420})
    return list((data.get('query') or {}).get('pages', {}).values())

def fetch(only):
    out = json.load(open('.cache/place-photos/index.json')) if os.path.exists('.cache/place-photos/index.json') else {}
    for region, queries in Q.items():
        if only and region not in only: continue
        if region in out and out[region] and not only: continue
        seen, keep = set(), []
        for q in queries:
            try: pages = search(q)
            except Exception as e: print('ERR', region, q, e); continue
            for p in pages:
                t = p['title']; ii = (p.get('imageinfo') or [{}])[0]
                if t in seen or BAD.search(t) or ii.get('mime') != 'image/jpeg' or ii.get('width',0) < 800: continue
                meta = ii.get('extmetadata', {})
                desc = re.sub('<[^>]+>','', (meta.get('ImageDescription',{}).get('value','') + ' ' + meta.get('Categories',{}).get('value','')))
                if not re.search(r'underwater|under water|snorkel|scuba|diving|dive|reef|coral|seagrass|posidonia|sous-marin|submarin|unterwasser', t + ' ' + desc, re.I): continue
                if re.search(r'aquarium|beach|aerial|from above|satellite', desc, re.I): continue
                seen.add(t)
                keep.append({'title': t, 'thumb': ii['thumburl'], 'page': ii['descriptionurl'],
                             'author': re.sub('<[^>]+>','', meta.get('Artist',{}).get('value',''))[:80],
                             'license': meta.get('LicenseShortName',{}).get('value','')})
            time.sleep(2)
        out[region] = keep[:30]
        print(region, len(keep))
        os.makedirs(f'.cache/place-photos/{region}', exist_ok=True)
        if only:
            for f in os.listdir(f'.cache/place-photos/{region}'): os.remove(f'.cache/place-photos/{region}/{f}')
        for i, k in enumerate(out[region]):
            path = f'.cache/place-photos/{region}/{i:02d}.jpg'
            if os.path.exists(path): continue
            try:
                with urllib.request.urlopen(urllib.request.Request(k['thumb'], headers=UA), timeout=30) as r, open(path,'wb') as f: f.write(r.read())
            except Exception as e: print('DL ERR', k['title'], e)
            time.sleep(0.6)
        json.dump(out, open('.cache/place-photos/index.json','w'), indent=1)

# ---------------------------------------------------------------- analyse
import colorsys, math, statistics as st

CACHE = '.cache/place-photos'
EXCLUDE = 'data/research/place-photo-exclusions.json'
# Must match src/sim/water.ts and src/sim/depth.ts.
DEEP_BLUE = (6, 26, 62)
# Most reef photos are taken around this depth.
PHOTO_DEPTH_M = 8


def median(cols):
    return [round(st.median(c[i] for c in cols)) for i in range(3)] if cols else None


def measure(path):
    """The open water at the top of a frame, and pale sand near its bottom, or None."""
    from PIL import Image
    im = Image.open(path).convert('RGB')
    im.thumbnail((160, 160))
    w, h = im.size
    px = im.load()
    every = [px[x, y] for y in range(h) for x in range(w)]
    mean = [sum(p[i] for p in every) / len(every) for i in range(3)]
    # Lit by the water itself: red is absorbed first, so blue and green lead.
    if not (mean[2] > mean[0] + 18 and mean[1] > mean[0] + 5):
        return None, None, None
    top = [px[x, y] for y in range(int(h * 0.35)) for x in range(w)]
    blue = [p for p in top if p[2] > p[0] + 25 and p[2] >= p[1] - 25 and max(p) > 50]
    bottom = [px[x, y] for y in range(int(h * 0.55), h) for x in range(w)]

    def pale(p):
        _, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in p))
        return s < 0.32 and v > 0.5

    pales = [p for p in bottom if pale(p)]
    water = median(blue) if len(blue) > 0.55 * len(top) else None
    sand = median(pales) if len(pales) > 0.12 * len(bottom) else None
    return water, sand, mean


def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def shallow_base(target, clarity):
    """The clear-shallow water colour that the app darkens to `target` at the photos' depth."""
    d = math.exp(-PHOTO_DEPTH_M / (35 + 45 * clarity))
    k = 0.45 + 0.55 * d
    return [max(0, min(255, round((t / k - b * (1 - d)) / d))) for t, b in zip(target, DEEP_BLUE)]


def true_sand(photo_sand, photo_water, app_sand):
    """Takes most of the water's cast off sand seen in a photo, at about the app's brightness."""
    top = max(photo_water)
    lifted = [s / (0.8 + 0.2 * w / top) for s, w in zip(photo_sand, photo_water)]
    scale = 0.92 * lum(app_sand) / max(1, lum(lifted))
    lifted = [min(255, c * scale) for c in lifted]
    return [round(a * 0.65 + b * 0.35) for a, b in zip(app_sand, lifted)]


def analyse():
    idx = json.load(open(f'{CACHE}/index.json'))
    exclude = set(json.load(open(EXCLUDE)))
    current = json.load(open(f'{CACHE}/current.json'))
    found = {}
    for region, items in idx.items():
        waters, sands, means, used = [], [], [], []
        for i, item in enumerate(items):
            path = f'{CACHE}/{region}/{i:02d}.jpg'
            if item['title'] in exclude or not os.path.exists(path):
                continue
            try:
                water, sand, mean = measure(path)
            except Exception:
                continue
            if mean: means.append(mean)
            if water: waters.append(water)
            if sand: sands.append(sand)
            if water or sand:
                used.append({k: item[k] for k in ('title', 'page', 'author', 'license')})
        found[region] = {'water': median(waters), 'sand': median(sands), 'mean': median(means),
                         'nWater': len(waters), 'nSand': len(sands), 'photos': used}
    # Places with few usable photos borrow from places with the same kind of reef.
    by_reef = {}
    for region, f in found.items():
        if f['nWater'] >= 3:
            by_reef.setdefault(current[region]['reef'], []).append(f['water'])
    # A reef type with no usable photos borrows from the rest of its ocean.
    oceans = {r['id']: r['ocean'] for r in json.load(open('data/ranges.json'))['regions']}
    by_ocean = {}
    for region, f in found.items():
        if f['nWater'] >= 3:
            by_ocean.setdefault(oceans[region], []).append(f['water'])
    out = {}
    for region, f in found.items():
        k = current[region]
        kin = by_reef.get(k['reef']) or by_ocean.get(oceans[region])
        kin_water = median(kin) if kin else None
        n = f['nWater']
        if n >= 3 or (n and not kin_water):
            target, source = f['water'], 'photos'
        elif n and kin_water:
            t = n / 3
            target = [round(a * t + b * (1 - t)) for a, b in zip(f['water'], kin_water)]
            source = 'photos and similar reefs'
        elif kin_water:
            target, source = kin_water, 'similar reefs'
        else:
            continue
        water = shallow_base(target, k['clarity'])
        sand = k['sand']
        if f['nSand'] >= 2 and f['water']:
            sand = true_sand(f['sand'], f['water'], k['sand'])
        # The water's cast at the photos' depth: the whole frame's average colour, its strongest
        # channel at 1. Red is absorbed first, so it is lowest almost everywhere.
        kin_mean = [found[r]['mean'] for r in found if found[r]['mean'] and found[r]['nWater'] >= 3
                    and (current[r]['reef'] == k['reef'] or oceans[r] == oceans[region])]
        frame = f['mean'] if f['mean'] and n >= 2 else (median(kin_mean) if kin_mean else target)
        top = max(frame)
        cast = [round(max(0.4, min(1, c / top)), 3) for c in frame]
        out[region] = {'water': water, 'sand': sand, 'cast': cast, 'measured': target,
                       'source': source, 'photos': f['photos'][:8]}
    json.dump(out, open('data/place-colours.json', 'w'), indent=1, ensure_ascii=False)
    for region, o in out.items():
        print(f"{region:20s} {o['source']:26s} water {o['water']} sand {o['sand']} cast {o['cast']}")


if __name__ == '__main__':
    if sys.argv[1:2] == ['fetch']:
        fetch(sys.argv[2:])
    elif sys.argv[1:2] == ['analyse']:
        analyse()
    else:
        print(__doc__)

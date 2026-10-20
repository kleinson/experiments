import {
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three'
import { limb } from './bodies.ts'
import { Batch, paint, place as placed } from './kit.ts'
import {
  anemone,
  barrel,
  blade,
  boulder,
  brain,
  branching,
  cucumber,
  elkhorn,
  fan,
  kelp,
  leather,
  plates,
  rock,
  seaStar,
  seaWhip,
  table,
  treeCoral,
  treeWorm,
  tubeSponge,
  urchin,
} from './reef.ts'
import { swayClock, swaying } from './sway.ts'
import type { Rgb } from './patterns.ts'
import { seeded } from './patterns.ts'
import type { Bed, Setting } from './seabed.ts'

/**
 * The seabed around the specimen: an illustrative diorama built from the
 * setting's mix of beds. Its pieces are drawn at real sizes in millimetres; their layout follows `extent`, so
 * the scenery is a setting, not a measured landscape.
 */
export type Scenery = {
  group: Group
  /** True when a ground plane is drawn (the specimen's own shadow falls on it). */
  ground: boolean
  /** True when something moves with the water. */
  animated: boolean
  sway: (seconds: number) => void
  /** Coral and rock tops fish graze, open sand goatfish root in, and anemones for clownfish. */
  feed: Vector3[]
  sand: Vector3[]
  homes: Vector3[]
  dispose: () => void
}

const rgb = ([r, g, b]: Rgb) => new Color(r / 255, g / 255, b / 255)
/** Horizontal direction toward the default camera: tall things stay out of this corridor. */
const TOWARD_VIEWER = new Vector2(260, 520).normalize()
/** How far the seabed reaches from the specimen; beyond it the water takes over. */
const REACH = 14

function track() {
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const textures: CanvasTexture[] = []
  return {
    geometry<T extends BufferGeometry>(value: T) {
      geometries.push(value)
      return value
    },
    material<T extends Material>(value: T) {
      materials.push(value)
      return value
    },
    texture(value: CanvasTexture) {
      textures.push(value)
      return value
    },
    dispose() {
      geometries.forEach((item) => item.dispose())
      materials.forEach((item) => item.dispose())
      textures.forEach((item) => item.dispose())
    },
  }
}
type Own = ReturnType<typeof track>

/** Sand with wind-and-wave ripples and grains, in the setting's ground colour. */
function groundTexture(colour: Rgb, ripples: number, own: Own) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The seabed could not be drawn.')
  const image = context.createImageData(size, size)
  const random = seeded(97)
  const TAU = Math.PI * 2
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // Ripple crests bend and fork a little, as they do on real sand.
      const u = x / size
      const v = y / size
      const bend =
        Math.sin(u * TAU * 2 + Math.sin(v * TAU) * 1.3) * 0.045 +
        Math.sin(u * TAU * 5 + v * TAU * 3) * 0.012
      const crest = Math.sin((v + bend) * TAU * 7)
      const ridge = Math.pow(Math.max(0, crest), 3) - 0.35 * Math.max(0, -crest)
      const patch =
        0.06 * Math.sin(u * TAU * 3 + 1.2) * Math.cos(v * TAU * 2 + 0.4)
      const grain = (random() - 0.5) * 0.16
      const light = 1 + ridge * 0.16 * ripples + patch + grain
      const i = (y * size + x) * 4
      image.data[i] = Math.min(255, colour[0] * light)
      image.data[i + 1] = Math.min(255, colour[1] * light)
      image.data[i + 2] = Math.min(255, colour[2] * light)
      image.data[i + 3] = 255
    }
  context.putImageData(image, 0, 0)
  const map = own.texture(new CanvasTexture(canvas))
  map.colorSpace = SRGBColorSpace
  map.wrapS = map.wrapT = RepeatWrapping
  map.anisotropy = 8
  return map
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function buildSeafloor(
  setting: Setting,
  extent: number,
  seed: number,
  specimen = extent,
): Scenery {
  const own = track()
  const group = new Group()
  group.name = 'seabed'
  const random = seeded(seed)
  // Sizes are real millimetres. `extent` (at least about 30 cm) only lays out the scene and keeps
  // open sand around the animal; `specimen` is the animal's own length.
  const E = extent
  const SWAY = 300
  /** Small things on the sand start just beyond the animal itself. */
  const near = Math.max(specimen * 1.3, 60)
  const URCHIN = 400
  const swayers: { object: Object3D; phase: number; amount: number }[] = []
  let snow: { points: Points; base: Float32Array; top: number } | null = null
  const mix = setting.mix
  const weight = (bed: Bed) => mix[bed] ?? 0
  const between = (a: number, b: number) => a + (b - a) * random()
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]!

  const standard = (colour: Rgb, roughness = 0.85, extra = {}) =>
    own.material(
      new MeshStandardMaterial({ color: rgb(colour), roughness, ...extra }),
    )

  /** Tall things stay out of the way: never in front of the animal, nor beside it within reach. */
  const allowed = (x: number, z: number, tall: boolean, wide = 0) => {
    if (!tall) return true
    const along = x * TOWARD_VIEWER.x + z * TOWARD_VIEWER.y
    const across = Math.abs(x * TOWARD_VIEWER.y - z * TOWARD_VIEWER.x)
    if (along > -E * 1.2 - wide && across < E * 2.4 + wide) return false
    return Math.hypot(x, z) >= E * 2 + wide
  }
  /** Somewhere on the seabed between `near` and `far`; tall things keep `wide` clear of the line of sight. */
  const spot = (near: number, far: number, tall: boolean, wide = 0) => {
    for (let tries = 0; tries < 30; tries++) {
      const angle = random() * Math.PI * 2
      const r = Math.sqrt(between(near * near, far * far))
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      if (allowed(x, z, tall, wide))
        return new Vector3(x, groundHeight(x, z), z)
    }
    return null
  }

  const deep = weight('deep') > 0.3
  /** The ground's height: flat around the specimen, gently rolling beyond, falling away on a slope. */
  const groundHeight = (x: number, z: number) => {
    const r = Math.hypot(x, z)
    const roll =
      (Math.sin(x / (E * 1.7)) * Math.cos(z / (E * 2.3)) +
        0.5 * Math.sin((x + z) / (E * 0.9))) *
      E *
      0.06 *
      smooth(E * 1.6, E * 5, r)
    const slope = deep ? Math.min(0, z + E * 2.2) * 0.35 : 0
    return roll + slope
  }

  if (setting.scene !== 'open-water') {
    const size = E * REACH * 2
    const geometry = new PlaneGeometry(size, size, 64, 64)
    geometry.rotateX(-Math.PI / 2)
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++)
      position.setY(i, groundHeight(position.getX(i), position.getZ(i)))
    geometry.computeVertexNormals()
    const sandy =
      setting.scene === 'beach' ? 1 : weight('sand') + weight('seagrass') * 0.5
    const map = groundTexture(setting.ground, Math.min(1, sandy * 1.4), own)
    // Ripples a few centimetres apart, as on real sand: one tile is about 60 cm.
    map.repeat.set(size / 600, size / 600)
    // The texture already carries the sand colour; it also lifts the ripples as relief.
    const ground = new Mesh(
      own.geometry(geometry),
      standard([255, 255, 255], 1, {
        map,
        bumpMap: map,
        bumpScale: 2.5,
        transparent: true,
      }),
    )
    // Only the ground fades out at its rim, so it alone needs blending.
    ;(ground.material as Material).userData.horizon = true
    ground.renderOrder = -1
    ground.receiveShadow = true
    ground.userData.ground = true
    ground.userData.inkGround = true
    group.add(ground)
  }

  // The reef: coral heads gathered on low rocky bommies, in the place's own forms and colours
  // (places.ts): table corals in the Indo-Pacific, elkhorn and sea fans in the Caribbean, soft
  // corals in the Red Sea. Everything is painted with vertex colours and merged into a few
  // meshes; whatever sways does so on the GPU (sway.ts).
  const place = setting.place
  const hard = new Batch()
  const soft = new Batch()
  const debris = new Batch()
  const feed: Vector3[] = []
  const sandSpots: Vector3[] = []
  const homes: Vector3[] = []
  const put = (
    batch: Batch,
    built: { pieces: BufferGeometry[]; top: number },
    at: Vector3,
    yaw = random() * Math.PI * 2,
  ) => {
    for (const piece of built.pieces) batch.add(placed(piece, at, yaw))
    return built.top
  }
  const coralColours: Rgb[] = place.palette
  const formOrder = [
    'branching',
    'massive',
    'table',
    'fan',
    'soft',
    'elkhorn',
  ] as const
  const formTotal = formOrder.reduce((sum, form) => sum + place.forms[form], 0)
  const pickForm = () => {
    let roll = random() * formTotal
    for (const form of formOrder) {
      roll -= place.forms[form]
      if (roll <= 0) return form
    }
    return 'massive'
  }
  const indoPacific = ![
    'caribbean',
    'caribbean-seagrass',
    'pink-sand',
    'posidonia',
    'rocky-algae',
  ].includes(place.reef)
  const caribbean = ['caribbean', 'caribbean-seagrass', 'pink-sand'].includes(
    place.reef,
  )
  const pale = (colour: Rgb): Rgb => [
    colour[0] + (240 - colour[0]) * 0.45,
    colour[1] + (232 - colour[1]) * 0.45,
    colour[2] + (220 - colour[2]) * 0.45,
  ]
  const coral = (at: Vector3, scale: number) => {
    const form = pickForm()
    const colour = pick(coralColours)
    let top = 0
    if (form === 'branching')
      top = put(hard, branching(random, scale, colour, pale(colour)), at)
    else if (form === 'elkhorn')
      top = put(hard, elkhorn(random, scale, colour), at)
    else if (form === 'table')
      top = put(
        hard,
        random() > 0.3
          ? table(random, scale, colour)
          : plates(random, scale, colour),
        at,
      )
    else if (form === 'massive') {
      top = put(
        hard,
        random() > 0.45
          ? brain(random, scale, colour, [
              colour[0] * 0.6,
              colour[1] * 0.6,
              colour[2] * 0.62,
            ])
          : boulder(random, scale, colour),
        at,
      )
      // Christmas tree worms on the big heads.
      if (random() > 0.5)
        for (let k = 0; k < 3; k++) {
          const a = random() * Math.PI * 2
          const r = scale * between(0.1, 0.3)
          put(
            hard,
            treeWorm(random, scale),
            at
              .clone()
              .add(
                new Vector3(
                  Math.cos(a) * r,
                  top * (1 - (r / scale) * 1.2),
                  Math.sin(a) * r,
                ),
              ),
          )
        }
    } else if (form === 'fan')
      top = put(
        soft,
        fan(
          random,
          scale,
          pick([
            [170, 90, 150],
            [214, 96, 86],
            [236, 170, 90],
            [150, 70, 160],
          ] as Rgb[]),
          SWAY,
        ),
        at,
      )
    else {
      const roll = random()
      if (roll < 0.35 && indoPacific) {
        top = put(
          soft,
          anemone(
            random,
            scale * 0.8,
            pick([
              [214, 180, 120],
              [170, 200, 120],
              [230, 150, 160],
            ] as Rgb[]),
            SWAY,
          ),
          at,
        )
        homes.push(at.clone().add(new Vector3(0, top, 0)))
      } else if (roll < 0.7)
        top = put(
          soft,
          leather(
            random,
            scale,
            pick([
              [196, 176, 120],
              [150, 170, 110],
              [210, 190, 150],
            ] as Rgb[]),
            SWAY,
          ),
          at,
        )
      else
        top = put(
          soft,
          treeCoral(
            random,
            scale,
            pick([
              [240, 110, 160],
              [190, 90, 200],
              [250, 150, 70],
              [240, 200, 90],
            ] as Rgb[]),
            SWAY,
          ),
          at,
        )
    }
    feed.push(at.clone().add(new Vector3(0, top, 0)))
  }
  const corals = Math.round(
    38 * weight('coral') * (0.35 + 0.65 * place.coral) +
      4 * weight('deep') * (setting.scene === 'seabed' ? 1 : 0),
  )
  if (corals) {
    // Bommies: a few low rocky mounds the corals grow on, so the reef reads as patches.
    const mounds: Vector3[] = []
    const moundCount = Math.max(2, Math.round(corals / 7))
    for (let m = 0; m < moundCount; m++) {
      const at = spot(E * 1.6, E * 7, true, 900)
      if (!at) continue
      mounds.push(at)
      put(
        hard,
        rock(
          random,
          between(400, 900),
          pick(place.rock),
          indoPacific ? [190, 130, 140] : [150, 120, 120],
          0.4,
        ),
        at.clone().add(new Vector3(0, -80, 0)),
      )
    }
    for (let i = 0; i < corals; i++) {
      // Real sizes: coral heads from about 30 cm to over a metre across.
      const scale = between(300, 1200)
      let at: Vector3 | null = null
      const mound = mounds.length ? pick(mounds) : null
      if (mound && random() > 0.25) {
        for (let tries = 0; tries < 8 && !at; tries++) {
          const a = random() * Math.PI * 2
          const r = between(150, 1100)
          const x = mound.x + Math.cos(a) * r
          const z = mound.z + Math.sin(a) * r
          if (allowed(x, z, true, scale * 0.5))
            at = new Vector3(
              x,
              groundHeight(x, z) + (r < 600 ? 160 * (1 - r / 600) : 0),
              z,
            )
        }
      }
      at ??= spot(E * 1.15, E * 7, true, scale * 0.6)
      if (at) coral(at, scale)
    }
  }

  // Sponges: tubes and barrels on Caribbean reefs; vases and sea whips on a deep slope.
  const sponges = caribbean ? Math.round(5 * weight('coral') + 1) : deep ? 6 : 0
  for (let i = 0; i < sponges; i++) {
    const scale = between(400, 900)
    const at = spot(E * 1.3, E * 6.5, true, scale * 0.4)
    if (!at) continue
    const colour = pick(
      (deep
        ? [
            [214, 170, 104],
            [200, 132, 98],
            [228, 200, 150],
          ]
        : [
            [150, 80, 170],
            [230, 190, 70],
            [200, 100, 70],
            [170, 110, 190],
          ]) as Rgb[],
    )
    const top = put(
      hard,
      random() > 0.5
        ? tubeSponge(random, scale, colour)
        : barrel(random, scale, colour),
      at,
    )
    feed.push(at.clone().add(new Vector3(0, top, 0)))
  }
  if (deep && setting.scene === 'seabed')
    for (let i = 0; i < 9; i++) {
      const at = spot(E * 1.3, E * 7, true)
      if (at)
        put(
          soft,
          seaWhip(
            random,
            SWAY,
            pick([
              [214, 92, 70],
              [236, 150, 70],
              [190, 70, 110],
            ] as Rgb[]),
            SWAY,
          ),
          at,
        )
    }

  // Rubble: broken, bleached coral branches.
  const bits = Math.round(46 * weight('rubble'))
  for (let i = 0; i < bits; i++) {
    const at = spot(near * 0.75, E * 6, false)
    if (!at) continue
    const length = between(40, 120)
    const piece = new CylinderGeometry(7, 10, length, 6, 1, false)
    piece.rotateZ(Math.PI / 2 - between(-0.1, 0.25))
    piece.translate(0, 8, 0)
    debris.add(
      placed(
        paint(
          piece,
          pick([
            [230, 222, 206],
            [214, 206, 190],
            [240, 234, 222],
          ] as Rgb[]),
        ),
        at,
      ),
    )
  }

  // Pebbles and shell fragments on sand.
  const pebbles = Math.round(
    40 * (weight('sand') + weight('rubble') * 0.5 + weight('seagrass') * 0.3),
  )
  for (let i = 0; i < pebbles; i++) {
    const at = spot(near * 0.7, E * 6, false)
    if (!at) continue
    const r = between(6, 30)
    const shard = random() > 0.75
    const geometry = shard
      ? new SphereGeometry(
          r * 1.4,
          10,
          4,
          0,
          Math.PI * between(0.6, 1.2),
          0,
          Math.PI * 0.4,
        )
      : new SphereGeometry(r, 8, 6)
    if (shard) geometry.rotateX(Math.PI)
    else geometry.scale(1, 0.55, 1)
    geometry.translate(0, r * 0.25, 0)
    debris.add(
      placed(
        paint(
          geometry,
          shard
            ? [238, 226, 214]
            : pick([
                [176, 168, 156],
                [204, 196, 182],
                [140, 132, 124],
              ] as Rgb[]),
        ),
        at,
      ),
    )
  }

  // Life on the sand: sea stars and sea cucumbers.
  if (
    setting.scene === 'seabed' &&
    (weight('sand') + weight('seagrass') + weight('rubble') > 0.2 || corals > 0)
  ) {
    const stars = 2 + Math.floor(random() * 3)
    for (let i = 0; i < stars; i++) {
      const at = spot(E * 1.6, E * 5, false)
      if (at)
        put(
          hard,
          seaStar(
            random,
            between(180, 400),
            pick(
              (indoPacific
                ? [
                    [60, 110, 200],
                    [230, 120, 60],
                    [200, 60, 60],
                  ]
                : [
                    [230, 150, 70],
                    [200, 80, 60],
                    [214, 170, 90],
                  ]) as Rgb[],
            ),
          ),
          at,
        )
    }
    const cukes = 1 + Math.floor(random() * 3)
    for (let i = 0; i < cukes; i++) {
      const at = spot(E * 1.6, E * 5, false)
      if (at)
        put(
          hard,
          cucumber(
            random,
            between(350, 650),
            pick([
              [40, 32, 30],
              [110, 80, 50],
              [70, 60, 40],
            ] as Rgb[]),
          ),
          at,
        )
    }
  }
  for (let i = 0; i < 24; i++) {
    const at = spot(near, E * 5.5, false)
    if (at) sandSpots.push(at)
  }

  // Rocks: weathered boulders, dark on volcanic coasts, with algae or encrusting growth on top,
  // and long-spined urchins in their shelter.
  const rocks = Math.round(16 * weight('rock') + (deep ? 6 : 0))
  const volcanic = setting.coast === 'volcanic'
  for (let i = 0; i < rocks; i++) {
    const granite = place.reef === 'granite'
    const r = granite ? between(600, 1800) : between(150, 650)
    const at = spot(E * 1.2, E * 7, r > 150, r)
    if (!at) continue
    const colour =
      deep && !volcanic
        ? pick([
            [84, 80, 78],
            [104, 98, 94],
          ] as Rgb[])
        : pick(place.rock)
    const cover: Rgb | null = deep
      ? null
      : volcanic
        ? [96, 120, 70]
        : granite
          ? [150, 150, 110]
          : [184, 132, 140]
    const top = put(
      hard,
      rock(
        random,
        r,
        colour,
        cover,
        granite ? between(0.6, 0.85) : between(0.45, 0.7),
      ),
      at.clone().add(new Vector3(0, -r * 0.12, 0)),
    )
    feed.push(at.clone().add(new Vector3(0, top - r * 0.12, 0)))
    if ((volcanic || weight('rock') > 0.5 || corals > 0) && random() > 0.55)
      put(
        hard,
        urchin(random, URCHIN),
        at
          .clone()
          .add(new Vector3(between(-0.6, 0.6) * r, 0, r * between(0.7, 1)))
          .setY(groundHeight(at.x, at.z + r)),
      )
  }
  if (corals > 0)
    for (let i = 0; i < 3; i++) {
      const at = spot(E * 2, E * 5, true)
      if (at) put(hard, urchin(random, URCHIN), at)
    }

  // Seagrass: many ribbon blades in patches. Turtle grass has broad, short, bright ribbons;
  // Neptune grass long, narrow, darker ones.
  const blades = Math.round(1100 * weight('seagrass'))
  if (blades) {
    const kind = place.grass
    // Real blades: turtle grass about a centimetre wide and up to 35 cm long; Neptune grass
    // about as wide and up to a metre long.
    const bladeWidth = kind === 'turtle' ? 10 : kind === 'posidonia' ? 9 : 5
    const tall = kind === 'posidonia' ? 2 : kind === 'turtle' ? 0.9 : 0.8
    const colour: Rgb = kind === 'posidonia' ? [70, 100, 46] : [92, 150, 80]
    const patches = Math.max(4, Math.round(16 * weight('seagrass')))
    let made = 0
    for (let p = 0; p < patches && made < blades; p++) {
      const centre = spot(E * 1.0, E * 6.5, false)
      if (!centre) continue
      const reach = E * between(0.6, 1.4)
      const per = Math.ceil(blades / patches)
      const phase = random() * 6
      for (let b = 0; b < per; b++) {
        const a = random() * Math.PI * 2
        const d = Math.sqrt(random()) * reach
        const x = centre.x + Math.cos(a) * d
        const z = centre.z + Math.sin(a) * d
        if (Math.hypot(x, z) < E * 0.8) continue
        const along = x * TOWARD_VIEWER.x + z * TOWARD_VIEWER.y
        const across = Math.abs(x * TOWARD_VIEWER.y - z * TOWARD_VIEWER.x)
        const low = along > -E * 0.4 || across < E * 1.6
        const height = tall * (low ? between(80, 160) : between(160, 380))
        const shade: Rgb = [
          colour[0] * between(0.85, 1.15),
          colour[1] * between(0.9, 1.1),
          colour[2] * between(0.85, 1.15),
        ]
        soft.add(
          placed(
            blade(random, bladeWidth, height, shade, SWAY, phase + x * 0.002),
            new Vector3(x, groundHeight(x, z), z),
            random() * Math.PI * 2,
          ),
        )
        made++
      }
    }
  }

  // Kelp and brown algae: tall stipes with blades and floats, and bushy Sargassum-like clumps.
  const plants = Math.round(22 * weight('kelp'))
  for (let i = 0; i < plants; i++) {
    const tall = random() > 0.45
    const at = spot(E * 1.3, E * 8, true, E * 0.3)
    if (at) put(soft, kelp(random, 400, tall), at)
  }

  const reefMesh = (batch: Batch, material: Material, ground = false) => {
    const geometry = batch.merge()
    if (!geometry) return
    const mesh = new Mesh(own.geometry(geometry), own.material(material))
    // Small debris is drawn as tone only: outlines on tiny pieces read as ink blots.
    if (ground) mesh.userData.inkGround = true
    group.add(mesh)
  }
  reefMesh(
    hard,
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      side: DoubleSide,
    }),
  )
  const swaysNow = soft.size > 0
  reefMesh(
    soft,
    swaying(
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.75,
        side: DoubleSide,
      }),
    ),
  )
  reefMesh(
    debris,
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    true,
  )

  // The beach: wet sand, the water's edge and its foam line.
  if (setting.scene === 'beach') {
    const shore = E * 2.4
    const wet = new Mesh(
      own.geometry(new PlaneGeometry(E * 1.2, E * 60).rotateX(-Math.PI / 2)),
      standard([150, 132, 104], 1, {
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    )
    wet.position.set(shore - E * 0.5, E * 0.004, 0)
    wet.userData.ground = true
    wet.userData.inkGround = true
    group.add(wet)
    const sea = new Mesh(
      own.geometry(new PlaneGeometry(E * 30, E * 60).rotateX(-Math.PI / 2)),
      standard([120, 180, 200], 0.2, {
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    )
    sea.position.set(shore + E * 15, E * 0.02, 0)
    sea.userData.ground = true
    sea.userData.inkGround = true
    group.add(sea)
    const foam: Vector3[] = []
    for (let k = 0; k <= 40; k++) {
      const z = -E * 12 + (k / 40) * E * 24
      foam.push(new Vector3(shore + Math.sin(z / E) * E * 0.15, E * 0.03, z))
    }
    const line = new Mesh(
      own.geometry(limb(foam, E * 0.03, 1, 120)),
      standard([250, 250, 246], 0.6),
    )
    line.userData.inkGround = true
    group.add(line)
    swayers.push({ object: line, phase: 0, amount: 0 })
  }

  // Drifting particles: marine snow in deep water, plankton in open water.
  if (deep || setting.scene === 'open-water') {
    const count = setting.scene === 'open-water' ? 500 : 320
    const base = new Float32Array(count * 3)
    const top = E * 4
    for (let i = 0; i < count; i++) {
      base[i * 3] = between(-1, 1) * E * 6
      base[i * 3 + 1] = between(-0.5, 1) * top
      base[i * 3 + 2] = between(-1, 1) * E * 6
    }
    const geometry = own.geometry(new BufferGeometry())
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(base.slice(), 3),
    )
    const points = new Points(
      geometry,
      own.material(
        new PointsMaterial({
          color: rgb(
            setting.scene === 'open-water' ? [214, 230, 220] : [236, 240, 244],
          ),
          size: 2.5,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
        }),
      ),
    )
    points.userData.noInk = true
    points.frustumCulled = false
    group.add(points)
    snow = { points, base, top }
  }

  const sway = (t: number) => {
    swayClock.value = t
    for (const item of swayers) {
      if (item.amount === 0) {
        item.object.position.x = Math.sin(t * 0.5) * E * 0.25
        continue
      }
      item.object.rotation.x = Math.sin(t * 0.7 + item.phase) * item.amount
      item.object.rotation.z = Math.cos(t * 0.5 + item.phase) * item.amount
    }
    if (snow) {
      const position = snow.points.geometry.getAttribute('position')
      const span = snow.top * 1.5
      for (let i = 0; i < position.count; i++) {
        const y0 = snow.base[i * 3 + 1]!
        let y = y0 - ((t * E * 0.05) % span)
        if (y < -snow.top * 0.5) y += span
        position.setXYZ(
          i,
          snow.base[i * 3]! + Math.sin(t * 0.3 + i) * E * 0.05,
          y,
          snow.base[i * 3 + 2]!,
        )
      }
      position.needsUpdate = true
    }
  }
  sway(0)

  return {
    group,
    ground: setting.scene !== 'open-water',
    animated: swayers.length > 0 || swaysNow || snow !== null,
    feed,
    sand: sandSpots,
    homes,
    sway,
    dispose: own.dispose,
  }
}

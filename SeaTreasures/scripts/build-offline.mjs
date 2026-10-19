import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const output = new URL('../dist/', import.meta.url)
async function filesAt(directory, prefix = './') {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory()) {
        return filesAt(
          new URL(`${entry.name}/`, directory),
          `${prefix}${entry.name}/`,
        )
      }
      return entry.name === 'sw.js' ? [] : [`${prefix}${entry.name}`]
    }),
  )
  return paths.flat().sort()
}
const files = await filesAt(output)
const hash = createHash('sha256')
for (const file of files) hash.update(await readFile(new URL(file, output)))
const version = hash.digest('hex').slice(0, 16)
const worker = `
const PREFIX = 'seatreasures:';
const CACHE = PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(['./', ...files])};
// Only these prebuilt assets are invariant across a server's CORS Vary headers.
const ASSETS = new Set(FILES.map((file) => new URL(file, self.registration.scope).href));
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async (error) => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(new URL('./index.html', self.registration.scope), { ignoreVary: true });
      if (!cached) throw error;
      return cached;
    }));
  } else if (ASSETS.has(url.href)) {
    event.respondWith(caches.open(CACHE)
      .then((cache) => cache.match(url.href, { ignoreVary: true }))
      .then((cached) => cached || fetch(event.request)));
  }
});
`
await writeFile(new URL('sw.js', output), worker)
console.info(`Offline bundle ${version}: ${files.length} local files.`)

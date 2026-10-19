import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const data = new URL('../shell-remembers/data/', import.meta.url)
const destination = new URL(
  '../shell-remembers/ios/Sources/ShellCore/Resources/',
  import.meta.url,
)
await mkdir(destination, { recursive: true })
for (const name of ['claims.json', 'experience.json']) {
  await copyFile(new URL(name, data), new URL(name, destination))
}
console.info(`Synced shared content to ${fileURLToPath(destination)}`)

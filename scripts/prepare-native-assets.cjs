const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const sourceIcon = path.join(root, 'public', 'icons', 'icon-512.png')

async function makeWindowsIcon() {
  const png = await sharp(sourceIcon).resize(256, 256).png().toBuffer()
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt8(0, 6)
  header.writeUInt8(0, 7)
  header.writeUInt8(0, 8)
  header.writeUInt8(0, 9)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(header.length, 18)

  const iconPath = path.join(root, 'assets', 'windows', 'icon.ico')
  await fs.mkdir(path.dirname(iconPath), { recursive: true })
  await fs.writeFile(iconPath, Buffer.concat([header, png]))
  console.log(`Created ${path.relative(root, iconPath)}`)
}

async function makeAndroidIcons() {
  const resourceRoot = path.join(root, 'android', 'app', 'src', 'main', 'res')
  try {
    await fs.access(path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'))
  } catch {
    throw new Error('Generate the Capacitor Android project first with `npx cap add android`.')
  }

  const densities = [
    { name: 'mdpi', icon: 48, foreground: 108 },
    { name: 'hdpi', icon: 72, foreground: 162 },
    { name: 'xhdpi', icon: 96, foreground: 216 },
    { name: 'xxhdpi', icon: 144, foreground: 324 },
    { name: 'xxxhdpi', icon: 192, foreground: 432 },
  ]

  for (const density of densities) {
    const directory = path.join(resourceRoot, `mipmap-${density.name}`)
    await fs.mkdir(directory, { recursive: true })
    const icon = await sharp(sourceIcon).resize(density.icon, density.icon).png().toBuffer()
    const foreground = await sharp(sourceIcon).resize(density.foreground, density.foreground).png().toBuffer()
    await Promise.all([
      fs.writeFile(path.join(directory, 'ic_launcher.png'), icon),
      fs.writeFile(path.join(directory, 'ic_launcher_round.png'), icon),
      fs.writeFile(path.join(directory, 'ic_launcher_foreground.png'), foreground),
    ])
  }

  const adaptiveDirectory = path.join(resourceRoot, 'mipmap-anydpi-v26')
  await fs.mkdir(adaptiveDirectory, { recursive: true })
  const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/lingo_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`
  await Promise.all([
    fs.writeFile(path.join(adaptiveDirectory, 'ic_launcher.xml'), adaptiveIcon),
    fs.writeFile(path.join(adaptiveDirectory, 'ic_launcher_round.xml'), adaptiveIcon),
    fs.mkdir(path.join(resourceRoot, 'values'), { recursive: true }),
  ])
  await fs.writeFile(
    path.join(resourceRoot, 'values', 'lingo_launcher_colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="lingo_launcher_background">#175ac0</color></resources>\n`,
  )
  console.log('Created Android launcher icons in android/app/src/main/res')
}

async function main() {
  const target = process.argv[2]
  if (target === 'windows') return makeWindowsIcon()
  if (target === 'android') return makeAndroidIcons()
  throw new Error('Choose one target: windows or android.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

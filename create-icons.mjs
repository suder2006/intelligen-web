import sharp from 'sharp'

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="80" fill="#0f172a"/>
  <rect x="40" y="40" width="432" height="432" rx="60" fill="#1e293b"/>
  <text x="256" y="200" font-family="Georgia, serif" font-size="120" font-weight="bold" fill="white" text-anchor="middle">I</text>
  <text x="256" y="320" font-family="Georgia, serif" font-size="60" font-weight="bold" fill="#38bdf8" text-anchor="middle">Gen</text>
  <rect x="80" y="360" width="352" height="6" rx="3" fill="#38bdf8" opacity="0.5"/>
</svg>`

const svgBuffer = Buffer.from(svg)

await sharp(svgBuffer).resize(192, 192).png().toFile('public/icon-192.png')
console.log('✅ icon-192.png created')

await sharp(svgBuffer).resize(512, 512).png().toFile('public/icon-512.png')
console.log('✅ icon-512.png created')

await sharp(svgBuffer).resize(1280, 720).png().toFile('public/screenshot.png')
console.log('✅ screenshot.png created')

console.log('🎉 All PWA icons created!')
// Renders public/icon.svg to the PNG sizes phones need for "Add to Home Screen".
import sharp from 'sharp'

const sizes = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]
for (const [out, size] of sizes) {
  await sharp('public/icon.svg', { density: 300 }).resize(size, size).png().toFile(out)
  console.log(out)
}

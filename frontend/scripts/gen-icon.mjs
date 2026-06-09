// ドット絵アイコン生成スクリプト（DotGothic16 のチカチカした雰囲気に合わせたダンベル）
// 16x16 のピクセルマップから SVG を組み立て、ImageMagick で PNG 化する。
import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = resolve(__dirname, '../public')

// 色（styles/index.css のトークンと一致させる）
const ORANGE = '#E86029' // accent / 背景
const INK = '#26272A' // ダンベル本体
const CREAM = '#F1EFDF' // ハイライト

// 16x16 ピクセルマップ。 . = 背景 / # = 墨 / o = クリームのハイライト
const art = [
  '................',
  '................',
  '................',
  '................',
  '.##..........##.',
  '.#o#........#o#.',
  '.###........###.',
  '.##############.',
  '.##oooooooooo##.',
  '.###........###.',
  '.##o........o##.',
  '.##..........##.',
  '................',
  '................',
  '................',
  '................',
]

const colorOf = { '#': INK, o: CREAM }

function buildSvg({ pad }) {
  // pad: アイコン外周に入れる余白セル数（maskable のセーフゾーン確保用）
  const n = 16
  const total = n + pad * 2
  const px = 64 // 1セルあたりの論理サイズ
  const size = total * px
  let rects = ''
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const c = art[y][x]
      if (c === '.') continue
      const fx = (x + pad) * px
      const fy = (y + pad) * px
      rects += `<rect x="${fx}" y="${fy}" width="${px}" height="${px}" fill="${colorOf[c]}"/>`
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${ORANGE}"/>${rects}</svg>`
}

function emit(name, svg, sizes) {
  const svgPath = resolve(pub, `${name}.svg`)
  writeFileSync(svgPath, svg)
  for (const s of sizes) {
    const out = resolve(pub, `${name}-${s}.png`)
    execSync(`magick -background none -density 384 "${svgPath}" -resize ${s}x${s} "${out}"`)
    console.log('wrote', out)
  }
  return svgPath
}

// 通常アイコン（フルブリード気味、余白1セル）
const anySvg = buildSvg({ pad: 1 })
writeFileSync(resolve(pub, 'icon.svg'), anySvg)
emit('pwa', anySvg, [192, 512])
execSync(`magick -background none -density 384 "${resolve(pub, 'icon.svg')}" -resize 180x180 "${resolve(pub, 'apple-touch-icon.png')}"`)
console.log('wrote apple-touch-icon.png')

// maskable（中央 ~64% に収まるよう余白5セル）
const maskSvg = buildSvg({ pad: 5 })
emit('maskable', maskSvg, [512])

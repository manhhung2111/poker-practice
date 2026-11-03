// Turns the single-file build (dist-single/index.html) into a page body for a
// claude.ai preview link: the host adds its own <!doctype>/<html>/<head>/<body>,
// so we keep only the title, metas, styles, body markup and the inlined script.
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('dist-single/index.html', 'utf8')
const head = src.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? ''
const body = src.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? ''

const pick = (re) => [...head.matchAll(re)].map((m) => m[0])
const title = pick(/<title>[\s\S]*?<\/title>/gi)
const metas = pick(/<meta name="(?:claude:viewport-fit-sides|theme-color)"[^>]*>/gi)
const fonts = pick(/<link\s+rel="(?:preconnect|stylesheet)"[^>]*>/gi).filter((l) => l.includes('fonts.g'))
const styles = pick(/<style[\s\S]*?<\/style>/gi)
const scripts = pick(/<script[\s\S]*?<\/script>/gi)

const out = [...title, ...metas, ...fonts, ...styles, body.trim(), ...scripts].join('\n')
writeFileSync('dist-single/poker-trainer.html', out + '\n')
console.log(`dist-single/poker-trainer.html: ${(out.length / 1024).toFixed(0)} KiB`)

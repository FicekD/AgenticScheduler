// Generates resources/icon.png (32x32 RGBA) with no dependencies.
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const W = 32
const H = 32

const table = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

// Rounded violet square on transparent background.
const raw = Buffer.alloc((W * 4 + 1) * H)
let p = 0
const r = 7
const inside = (x, y) => {
  const cx = Math.min(x, W - 1 - x)
  const cy = Math.min(y, H - 1 - y)
  if (cx >= r || cy >= r) return true
  const dx = r - cx
  const dy = r - cy
  return dx * dx + dy * dy <= r * r
}
for (let y = 0; y < H; y++) {
  raw[p++] = 0 // filter: none
  for (let x = 0; x < W; x++) {
    if (inside(x, y)) {
      raw[p++] = 124
      raw[p++] = 58
      raw[p++] = 237
      raw[p++] = 255
    } else {
      raw[p++] = 0
      raw[p++] = 0
      raw[p++] = 0
      raw[p++] = 0
    }
  }
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
])

const dir = path.join(__dirname, '..', 'resources')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'icon.png'), png)
console.log('wrote resources/icon.png')

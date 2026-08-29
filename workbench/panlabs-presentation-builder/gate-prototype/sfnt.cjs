// Verify an sfnt (TTF/OTF) with nothing but arithmetic: every table carries a
// checksum, and `head` carries a checksum over the whole file. No font library.
function verify(buf) {
  if (buf.length < 12) return 'shorter than an sfnt header';
  const tag = buf.readUInt32BE(0);
  if (![0x00010000, 0x4f54544f, 0x74727565].includes(tag))
    return `signature 0x${tag.toString(16)} is not sfnt`;
  const n = buf.readUInt16BE(4);
  if (12 + n * 16 > buf.length) return `table directory claims ${n} tables, past the end of the payload`;
  const sum = (start, len) => {
    let s = 0;
    for (let i = start; i < start + len; i += 4) {
      let w = 0;
      for (let k = 0; k < 4; k++) w = (w * 256) + (i + k < buf.length ? buf[i + k] : 0);
      s = (s + w) % 4294967296;
    }
    return s;
  };
  for (let i = 0; i < n; i++) {
    const d = 12 + i * 16;
    const name = buf.toString('latin1', d, d + 4);
    const want = buf.readUInt32BE(d + 4);
    const off = buf.readUInt32BE(d + 8), len = buf.readUInt32BE(d + 12);
    if (off + len > buf.length + 3) return `table '${name}' claims bytes ${off}..${off + len}, past the end of the payload`;
    let got = sum(off, (len + 3) & ~3);
    if (name === 'head') {                        // head zeroes checkSumAdjustment
      let adj = 0;
      for (let k = 0; k < 4; k++) adj = adj * 256 + buf[off + 8 + k];
      got = (got - adj + 4294967296 * 2) % 4294967296;
    }
    if (got !== want) return `table '${name}' checksum is 0x${got.toString(16)}, the directory says 0x${want.toString(16)} -- the payload is corrupt`;
  }
  return null;
}
module.exports = { verify };

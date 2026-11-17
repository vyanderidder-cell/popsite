/* glTF JSON dont le tampon binaire est embarqué en base64 : reconstitué en GLB en mémoire (aucun fetch de data:) */
export async function loadPacked(loader, url) {
  const j = await fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  const b64 = j.buffers[0].uri.split(',')[1], s = atob(b64), n = s.length, bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = s.charCodeAt(i);
  delete j.buffers[0].uri; j.buffers[0].byteLength = n;
  const js = new TextEncoder().encode(JSON.stringify(j));
  const jl = (js.length + 3) & ~3, bl = (n + 3) & ~3;
  const out = new ArrayBuffer(12 + 8 + jl + 8 + bl), dv = new DataView(out), u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.byteLength, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true); u8.set(js, 20);
  for (let i = js.length; i < jl; i++) u8[20 + i] = 0x20;
  const o = 20 + jl; dv.setUint32(o, bl, true); dv.setUint32(o + 4, 0x004E4942, true); u8.set(bin, o + 8);
  return loader.parseAsync(out, url.slice(0, url.lastIndexOf('/') + 1));
}

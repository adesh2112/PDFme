'use strict';
/**
 * Zero-dependency PKZip encoder/decoder using standard Web APIs
 * Compatible with Node.js 18+ and modern browsers.
 */

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates a standard PKZip Uint8Array from an object of { filename: Uint8Array | string }
 */
function createZip(files) {
  const encoder = new TextEncoder();
  const fileEntries = [];
  let offset = 0;

  for (const [filename, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(filename);
    const dataBytes = typeof content === 'string' ? encoder.encode(content) : new Uint8Array(content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + name length)
    const header = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true); // Local header signature
    dv.setUint16(4, 20, true);         // Version needed
    dv.setUint16(6, 0, true);          // General purpose bit flag
    dv.setUint16(8, 0, true);          // Compression method (0 = stored / uncompressed)
    dv.setUint16(10, 0, true);         // Mod time
    dv.setUint16(12, 0, true);         // Mod date
    dv.setUint32(14, crc, true);       // CRC-32
    dv.setUint32(18, size, true);      // Compressed size
    dv.setUint32(22, size, true);      // Uncompressed size
    dv.setUint16(26, nameBytes.length, true); // File name length
    dv.setUint16(28, 0, true);         // Extra field length
    header.set(nameBytes, 30);

    fileEntries.push({
      header,
      data: dataBytes,
      offset,
      nameBytes,
      crc,
      size
    });

    offset += header.length + dataBytes.length;
  }

  // Central directory
  const cdStart = offset;
  const cdEntries = [];
  let cdSize = 0;

  for (const entry of fileEntries) {
    const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
    const dv = new DataView(cdHeader.buffer);
    dv.setUint32(0, 0x02014b50, true); // Central directory signature
    dv.setUint16(4, 20, true);         // Version made by
    dv.setUint16(6, 20, true);         // Version needed
    dv.setUint16(8, 0, true);          // General purpose bit flag
    dv.setUint16(10, 0, true);         // Compression method (0 = stored)
    dv.setUint16(12, 0, true);         // Mod time
    dv.setUint16(14, 0, true);         // Mod date
    dv.setUint32(16, entry.crc, true); // CRC-32
    dv.setUint32(20, entry.size, true);// Compressed size
    dv.setUint32(24, entry.size, true);// Uncompressed size
    dv.setUint16(28, entry.nameBytes.length, true); // Name length
    dv.setUint16(30, 0, true);         // Extra field length
    dv.setUint16(32, 0, true);         // Comment length
    dv.setUint16(34, 0, true);         // Disk number start
    dv.setUint16(36, 0, true);         // Internal file attributes
    dv.setUint32(38, 0, true);         // External file attributes
    dv.setUint32(42, entry.offset, true); // Relative offset of local header
    cdHeader.set(entry.nameBytes, 46);

    cdEntries.push(cdHeader);
    cdSize += cdHeader.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdDv = new DataView(eocd.buffer);
  eocdDv.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdDv.setUint16(4, 0, true);          // Disk number
  eocdDv.setUint16(6, 0, true);          // Start disk
  eocdDv.setUint16(8, fileEntries.length, true);  // Disk entries
  eocdDv.setUint16(10, fileEntries.length, true); // Total entries
  eocdDv.setUint32(12, cdSize, true);    // Central directory size
  eocdDv.setUint32(16, cdStart, true);   // Central directory offset
  eocdDv.setUint16(20, 0, true);         // Comment length

  // Total buffer length
  const totalLength = offset + cdSize + 22;
  const result = new Uint8Array(totalLength);
  let pos = 0;

  for (const entry of fileEntries) {
    result.set(entry.header, pos);
    pos += entry.header.length;
    result.set(entry.data, pos);
    pos += entry.data.length;
  }

  for (const cdHeader of cdEntries) {
    result.set(cdHeader, pos);
    pos += cdHeader.length;
  }

  result.set(eocd, pos);
  return result;
}

/**
 * Reads a PKZip Uint8Array and returns an object of { [filename]: Uint8Array }
 */
function readZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = {};

  // Find End of Central Directory Record (EOCD) from the end
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    // If no central directory, scan local headers directly
    let pos = 0;
    while (pos < bytes.length - 30) {
      if (dv.getUint32(pos, true) !== 0x04034b50) break;
      const method = dv.getUint16(pos + 8, true);
      const compSize = dv.getUint32(pos + 18, true);
      const nameLen = dv.getUint16(pos + 26, true);
      const extraLen = dv.getUint16(pos + 28, true);
      const filename = decoder.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
      const dataStart = pos + 30 + nameLen + extraLen;
      const data = bytes.subarray(dataStart, dataStart + compSize);
      if (method === 0) {
        files[filename] = data;
      }
      pos = dataStart + compSize;
    }
    return files;
  }

  const numEntries = dv.getUint16(eocdOffset + 10, true);
  const cdOffset = dv.getUint32(eocdOffset + 16, true);

  let cdPos = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    if (cdPos + 46 > bytes.length) break;
    if (dv.getUint32(cdPos, true) !== 0x02014b50) break;

    const method = dv.getUint16(cdPos + 10, true);
    const compSize = dv.getUint32(cdPos + 20, true);
    const uncompSize = dv.getUint32(cdPos + 24, true);
    const nameLen = dv.getUint16(cdPos + 28, true);
    const extraLen = dv.getUint16(cdPos + 30, true);
    const commentLen = dv.getUint16(cdPos + 32, true);
    const localHeaderOffset = dv.getUint32(cdPos + 42, true);

    const filename = decoder.decode(bytes.subarray(cdPos + 46, cdPos + 46 + nameLen));

    if (localHeaderOffset + 30 <= bytes.length) {
      const localNameLen = dv.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = dv.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const rawData = bytes.subarray(dataStart, dataStart + compSize);

      if (method === 0) {
        files[filename] = rawData;
      } else {
        // Method 8 is deflate. For now store raw or uncompressed
        files[filename] = rawData;
        files[filename]._compressed = true;
        files[filename]._method = method;
        files[filename]._uncompSize = uncompSize;
      }
    }

    cdPos += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createZip, readZip, crc32 };
}
if (typeof window !== 'undefined') {
  window.ZipUtil = { createZip, readZip, crc32 };
}


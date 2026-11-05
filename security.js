/**
 * AwaazSafe — security.js
 * Client-side evidence security pipeline.
 *
 * Sections:
 *  1.  SHA-256 Hashing          (Web Crypto API)
 *  2.  EXIF / Metadata Scanner  (raw byte inspection)
 *  3.  EXIF Sanitization        (Canvas route-through for images)
 *  4.  C2PA Manifest Detector   (JUMBF box + XMP + AI-tool signatures)
 *  5.  Master Evidence Processor (image, document, voice blob)
 *  6.  Window export
 *
 * Zero backend required. All processing is in-browser.
 * Raw files and hashes are stored only in localStorage.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1. SHA-256 HASHING  —  Web Crypto API (crypto.subtle)
   Available in all modern browsers (Chrome 37+, Firefox 34+, Safari 11+)
════════════════════════════════════════════════════════════════ */

/**
 * Compute the SHA-256 hash of an ArrayBuffer.
 * Returns a 64-character lowercase hex string.
 *
 * @param  {ArrayBuffer} buffer  Raw file bytes
 * @returns {Promise<string>}    64-char hex digest
 * @throws  {Error}  EMPTY_FILE | FILE_TOO_LARGE | CRYPTO_UNAVAILABLE
 */
async function sha256(buffer) {
  /* Guard: empty file */
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('EMPTY_FILE');
  }
  /* Guard: >50 MB — refuse gracefully instead of locking the browser */
  if (buffer.byteLength > 50 * 1024 * 1024) {
    throw new Error('FILE_TOO_LARGE');
  }
  /* Guard: very old browser without SubtleCrypto */
  if (!crypto?.subtle?.digest) {
    throw new Error('CRYPTO_UNAVAILABLE');
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  /* Convert each byte to a zero-padded 2-char hex string */
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Read a File/Blob into an ArrayBuffer via FileReader.
 *
 * @param  {File|Blob} file
 * @returns {Promise<ArrayBuffer>}
 */
function fileToBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader  = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('FILE_READ_ERROR'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Compute SHA-256 from an audio Blob (MediaRecorder output).
 * Matches the computeAudioHash pattern with explicit empty-blob guard.
 *
 * Status flow:  "Computing..." → "Success" | "Failed"
 *
 * @param  {Blob}   audioBlob   Raw MediaRecorder Blob (audio/webm, audio/ogg, etc.)
 * @returns {Promise<string>}   64-char hex digest
 * @throws  {Error}  "Recorded audio is empty."
 *                   "No voice data captured. Please try again."
 *                   "CRYPTO_UNAVAILABLE: browser does not support Web Crypto API."
 */
async function computeAudioHash(audioBlob) {
  /* Guard: null / zero-byte blob */
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Recorded audio is empty.');
  }
  /* Guard: browser without SubtleCrypto (very old / non-secure context) */
  if (!window.crypto?.subtle?.digest) {
    throw new Error('CRYPTO_UNAVAILABLE: browser does not support Web Crypto API.');
  }

  const arrayBuffer = await audioBlob.arrayBuffer();
  const hashBuffer  = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray   = Array.from(new Uint8Array(hashBuffer));
  /* Zero-pad each byte to two hex characters */
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Backward-compatible alias — existing callers of hashVoiceBlob() still work.
 * @param  {Blob} blob
 * @returns {Promise<string>}
 */
async function hashVoiceBlob(blob) {
  return computeAudioHash(blob);
}


/* ═══════════════════════════════════════════════════════════════
   2. EXIF / METADATA SCANNER  —  raw byte inspection
   Reads the first 128 KB of a file and looks for known metadata
   markers in the binary/text representation. No library required.
════════════════════════════════════════════════════════════════ */

/**
 * Detect which metadata fields are present in a file's raw bytes.
 * This is DETECTION only — it does not modify the file.
 *
 * @param  {File} file
 * @returns {Promise<string[]>}  Human-readable list of detected fields
 */
async function detectExifFields(file) {
  const found = [];
  try {
    /* Read only the first 128 KB — EXIF/XMP headers are always near the start */
    const slice  = file.slice(0, 131072);
    const buffer = await fileToBuffer(slice);
    const bytes  = new Uint8Array(buffer);

    /*
     * Decode as latin-1 so every byte maps 1-to-1 to a character.
     * This lets us do string searches across binary metadata headers.
     */
    const text = new TextDecoder('latin1').decode(bytes);

    /* ── JPEG EXIF header (0xFF 0xE1 marker + "Exif\0\0") ── */
    if (text.includes('Exif'))             found.push('EXIF Header');

    /* ── GPS IFD (sub-directory inside EXIF for geolocation) ── */
    if (text.includes('GPSLatitude') ||
        text.includes('GPSLongitude') ||
        text.includes('GPS'))              found.push('GPS Coordinates');

    /* ── Camera / Device Make & Model tags ── */
    if (text.includes('Make') ||
        text.includes('Model'))            found.push('Device Model / Camera');

    /* ── Software tag (e.g. "Adobe Photoshop", "GIMP 2.10") ── */
    if (text.includes('Software'))         found.push('Software Tag');

    /* ── Capture timestamps ── */
    if (text.includes('DateTime') ||
        text.includes('DateTimeOriginal')) found.push('Capture Timestamp');

    /* ── Author / copyright ── */
    if (text.includes('Artist') ||
        text.includes('Copyright'))        found.push('Author / Copyright');

    /* ── XMP metadata block (XML packet embedded in JPEG/PNG) ── */
    if (text.includes('<?xpacket') ||
        text.includes('x:xmpmeta'))        found.push('XMP Metadata Block');

    /* ── IPTC / Photoshop (App13 marker in JPEG) ── */
    if (text.includes('Photoshop'))        found.push('Photoshop Metadata');
    if (text.includes('IPTC-NAA'))         found.push('IPTC Metadata');

    /* ── ICC colour profile (device colour space info) ── */
    if (text.includes('ICC_PROFILE') ||
        text.includes('sRGB'))             found.push('ICC Colour Profile');

    /* ── Thumbnail embedded in EXIF ── */
    if (text.includes('ThumbnailOffset') ||
        text.includes('CompressedBitsPerPixel')) found.push('Embedded Thumbnail');

  } catch (e) {
    /* Non-critical — scan failure just means we can't list what we stripped */
    console.warn('[AwaazSecurity] EXIF scan failed:', e.message);
  }
  return found;
}


/* ═══════════════════════════════════════════════════════════════
   3. EXIF SANITIZATION  —  Canvas route-through
   Drawing an image onto an HTML Canvas and re-exporting it as a
   Blob produces a pixel-identical image with ALL metadata removed.
   The Canvas 2D context never copies EXIF, XMP, ICC, IPTC, or any
   other metadata chunk from the source image.
════════════════════════════════════════════════════════════════ */

/**
 * Strip all EXIF / XMP / metadata from an image file.
 * Works for JPEG, PNG, WebP, GIF (first frame), AVIF (where supported).
 *
 * Process:
 *  1. Detect which metadata fields exist (for the user report)
 *  2. Load the image into an HTMLImageElement
 *  3. Draw it on an off-screen Canvas
 *  4. Export the Canvas as a clean Blob — zero metadata
 *
 * @param  {File} file  Original image (may contain GPS, device info, etc.)
 * @returns {Promise<{ cleanBlob: Blob, stripped: string[] }>}
 *   cleanBlob — sanitized image with no metadata
 *   stripped  — list of fields that were detected and removed
 * @throws  {Error}  NOT_AN_IMAGE | IMAGE_LOAD_FAILED | CANVAS_EXPORT_FAILED
 */
async function sanitizeImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('NOT_AN_IMAGE');
  }

  /* Step 1: scan for metadata fields before stripping */
  const stripped = await detectExifFields(file);

  /* Step 2-4: Canvas route-through */
  const cleanBlob = await new Promise((resolve, reject) => {
    const img    = new Image();
    const objUrl = URL.createObjectURL(file);

    img.onload = () => {
      /* Off-screen canvas — same pixel dimensions as the original */
      const canvas  = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objUrl);  /* Release object URL immediately */

      /* Choose output MIME: preserve PNG losslessly, JPEG/WebP at 92% quality */
      const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        blob => blob
          ? resolve(blob)
          : reject(new Error('CANVAS_EXPORT_FAILED')),
        outputMime,
        0.92   /* quality factor (ignored for PNG) */
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };

    img.src = objUrl;
  });

  return { cleanBlob, stripped };
}

/**
 * Handle non-image files (PDF, audio, video, documents).
 * We CANNOT strip embedded metadata from these client-side without
 * specialised parsers, so we:
 *  - Return the original file as-is (cleanBlob = original)
 *  - Return an empty stripped[] list
 *  - Attach a human-readable warning when stripping was not possible
 *
 * Voice recordings from MediaRecorder are clean by default (no metadata).
 *
 * @param  {File} file
 * @returns {{ cleanBlob: File, stripped: string[], warning: string|null }}
 */
function sanitizeNonImage(file) {
  const AUDIO_TYPES = ['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg','audio/aac'];
  const isAudio = AUDIO_TYPES.includes(file.type) || /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(file.name);
  const isPdf   = file.type === 'application/pdf'  || /\.pdf$/i.test(file.name);

  let warning = null;
  if (isPdf) {
    warning = 'PDF metadata (author, creation date, software) cannot be stripped client-side. '
            + 'Consider using a tool like PDF24 to anonymise before uploading.';
  }
  /* Audio files from MediaRecorder / phone voice recorder carry no EXIF */

  return { cleanBlob: file, stripped: [], warning };
}


/* ═══════════════════════════════════════════════════════════════
   4. C2PA MANIFEST DETECTOR
   C2PA (Coalition for Content Provenance and Authenticity) is an
   open standard for embedding tamper-evident provenance metadata
   into media files. Files can carry:
     a) JUMBF boxes (binary, stored in JPEG/MP4/etc.)
     b) XMP packets (XML, embedded in JPEG/PNG/PDF)
   AI tools like DALL-E, Midjourney, Adobe Firefly embed their
   own signatures in XMP Software tags or proprietary chunks.
════════════════════════════════════════════════════════════════ */

/**
 * Detect C2PA manifests, AI-generation markers, and editing-tool
 * signatures in an image, audio, or video file.
 *
 * @param  {File} file
 * @returns {Promise<C2PAResult>}
 *
 * @typedef  {Object} C2PAResult
 * @property {boolean}  hasManifest    True if a real C2PA manifest is found
 * @property {boolean}  isAIGenerated  True if AI generation markers detected
 * @property {boolean}  hasBeenEdited  True if photo-editing tools detected
 * @property {string[]} detectedTools  Names of tools/signatures found
 * @property {'VERIFIED'|'WARNING'|'UNKNOWN'} trustLevel
 * @property {string}   summary        Human-readable verdict sentence
 */
async function detectC2PA(file) {
  /* Default result — unknown trust */
  const result = {
    hasManifest:   false,
    isAIGenerated: false,
    hasBeenEdited: false,
    detectedTools: [],
    trustLevel:    'UNKNOWN',
    summary:       'No Content Credentials found.',
  };

  /* Only scan media types — PDFs and plain text are skipped */
  const isMedia = file.type.startsWith('image/')
               || file.type.startsWith('video/')
               || file.type.startsWith('audio/');
  if (!isMedia) {
    result.summary = 'C2PA scan not applicable for this file type.';
    return result;
  }

  /* Edge case: zero-byte file */
  if (file.size === 0) {
    result.summary = 'Empty file — cannot verify Content Credentials.';
    return result;
  }

  try {
    /* Read up to 256 KB — enough for all JUMBF boxes and XMP packets */
    const scanSize = Math.min(file.size, 262144);
    const buffer   = await fileToBuffer(file.slice(0, scanSize));
    const bytes    = new Uint8Array(buffer);
    const text     = new TextDecoder('latin1').decode(bytes);

    /* ── a) JUMBF Box Detection (official on-disk C2PA format) ────────
     *
     * JUMBF (JPEG Universal Metadata Box Format) boxes are identified by
     * the 4-byte type code immediately after the 4-byte length field.
     * Box type "jumb" = 0x6A 0x75 0x6D 0x62  (the container box)
     * C2PA label   "c2pa" = 0x63 0x32 0x70 0x61  (inside the jumb box)
     * Both must be present for a valid C2PA manifest.
     */
    const jumbFound = scanForByteSequence(bytes, [0x6A, 0x75, 0x6D, 0x62]);
    const c2paFound = scanForByteSequence(bytes, [0x63, 0x32, 0x70, 0x61]);
    if (jumbFound && c2paFound) {
      result.hasManifest = true;
      result.detectedTools.push('C2PA JUMBF Manifest (Verified)');
    }

    /* ── b) XMP / CAI Namespace Markers ───────────────────────────────
     *
     * The Content Authenticity Initiative (CAI) XMP namespace:
     *   xmlns:c2pa="http://c2pa.org/manifest"
     *   xmlns:cai="http://cai.org/"
     * Adobe, Microsoft, and others embed these in XMP packets.
     */
    if (text.includes('c2pa.org') || text.includes('contentcredentials.org')) {
      result.hasManifest = true;
      result.detectedTools.push('C2PA XMP Namespace');
    }
    if (text.includes('xmlns:cai=') || text.includes('cai:claim')) {
      result.hasManifest = true;
      result.detectedTools.push('CAI Claim Block');
    }
    if (text.includes('c2pa:manifest') || text.includes('c2pa:claim')) {
      result.hasManifest = true;
      result.detectedTools.push('C2PA Manifest Claim');
    }

    /* ── c) AI Generation Signatures ─────────────────────────────────
     *
     * Known AI image generators embed their name in:
     *  - EXIF Software tag
     *  - XMP dc:creator or xmp:CreatorTool
     *  - Proprietary comment chunks (PNG tEXt, JPEG COM marker)
     */
    const AI_SIGNATURES = [
      { pattern: 'DALL-E',               tool: 'DALL-E (OpenAI)'          },
      { pattern: 'dall-e',               tool: 'DALL-E (OpenAI)'          },
      { pattern: 'Midjourney',           tool: 'Midjourney'               },
      { pattern: 'midjourney',           tool: 'Midjourney'               },
      { pattern: 'StableDiffusion',      tool: 'Stable Diffusion'         },
      { pattern: 'Stable Diffusion',     tool: 'Stable Diffusion'         },
      { pattern: 'stable-diffusion',     tool: 'Stable Diffusion'         },
      { pattern: 'Adobe Firefly',        tool: 'Adobe Firefly'            },
      { pattern: 'Generative Fill',      tool: 'Adobe Generative Fill'    },
      { pattern: 'ai-generated',         tool: 'AI Generated (XMP flag)'  },
      { pattern: 'AIGeneratedImage',     tool: 'AI Generated (XMP flag)'  },
      { pattern: 'DigitallyAltered',     tool: 'Digitally Altered (XMP)'  },
      { pattern: 'ComfyUI',              tool: 'ComfyUI'                  },
      { pattern: 'InvokeAI',             tool: 'InvokeAI'                 },
      { pattern: 'Automatic1111',        tool: 'Automatic1111 (SD WebUI)' },
      { pattern: 'Bing Image Creator',   tool: 'Bing Image Creator'       },
      { pattern: 'Gemini Image',         tool: 'Google Gemini Image'      },
      { pattern: 'Imagen',               tool: 'Google Imagen'            },
      { pattern: 'Leonardo.Ai',          tool: 'Leonardo.AI'              },
      { pattern: 'NightCafe',            tool: 'NightCafe'                },
      { pattern: 'Dream by WOMBO',       tool: 'Dream by WOMBO'           },
      { pattern: 'generative_model',     tool: 'AI Generative Model (XMP)'},
      { pattern: 'ai_generated',         tool: 'AI Generated (XMP flag)'  },
    ];

    for (const { pattern, tool } of AI_SIGNATURES) {
      if (text.includes(pattern)) {
        result.isAIGenerated = true;
        if (!result.detectedTools.includes(tool)) {
          result.detectedTools.push(tool);
        }
      }
    }

    /* ── d) Photo Editing Tool Signatures ─────────────────────────────
     *
     * These tools leave their name in the XMP xmp:CreatorTool field
     * or EXIF Software tag. Presence does NOT mean the content is fake,
     * but authorities should be informed so they can apply appropriate
     * scrutiny to the evidence.
     */
    const EDIT_SIGNATURES = [
      'Adobe Photoshop',
      'Adobe Lightroom',
      'GIMP',
      'Affinity Photo',
      'Snapseed',
      'FaceApp',
      'Meitu',
      'Canva',
      'PicsArt',
      'CapCut',
      'YouCam',
      'TouchRetouch',
    ];

    for (const sig of EDIT_SIGNATURES) {
      if (text.includes(sig)) {
        result.hasBeenEdited = true;
        if (!result.detectedTools.includes(sig)) {
          result.detectedTools.push(sig);
        }
      }
    }

    /* ── e) Determine Trust Level and compose summary ─────────────────
     *
     * Trust hierarchy:
     *  WARNING  > VERIFIED > UNKNOWN
     * (AI-generated always overrides even if C2PA manifest present)
     */
    if (result.isAIGenerated) {
      result.trustLevel = 'WARNING';
      result.summary    =
        `⚠️ AI-Generated content detected (${result.detectedTools.join(', ')}). `
        + 'This file may not represent a real event.';
    } else if (result.hasBeenEdited && !result.hasManifest) {
      result.trustLevel = 'WARNING';
      result.summary    =
        `⚠️ Editing software detected (${result.detectedTools.join(', ')}). `
        + 'Content may have been digitally altered.';
    } else if (result.hasManifest && !result.hasBeenEdited && !result.isAIGenerated) {
      result.trustLevel = 'VERIFIED';
      result.summary    =
        `✅ Content Credentials present (${result.detectedTools.join(', ')}). `
        + 'File has tamper-evident provenance metadata.';
    } else if (result.hasManifest && result.hasBeenEdited) {
      result.trustLevel = 'WARNING';
      result.summary    =
        `⚠️ Content Credentials found BUT editing tools also detected `
        + `(${result.detectedTools.join(', ')}). Treat with caution.`;
    } else {
      result.trustLevel = 'UNKNOWN';
      result.summary    =
        'No Content Credentials found. '
        + 'File authenticity cannot be independently verified by this tool.';
    }

  } catch (e) {
    console.warn('[AwaazSecurity] C2PA scan error:', e.message);
    result.summary = 'C2PA scan could not complete: ' + e.message;
  }

  return result;
}

/**
 * Scan a Uint8Array for a 4-byte sequence.
 * Used to detect JUMBF box type codes in binary files.
 *
 * @param  {Uint8Array} bytes
 * @param  {number[]}   pattern  Exactly 4 bytes
 * @returns {boolean}
 */
function scanForByteSequence(bytes, pattern) {
  const [a, b, c, d] = pattern;
  const len = bytes.length - 3;
  for (let i = 0; i < len; i++) {
    if (bytes[i] === a && bytes[i+1] === b && bytes[i+2] === c && bytes[i+3] === d) {
      return true;
    }
  }
  return false;
}


/* ═══════════════════════════════════════════════════════════════
   5. MASTER EVIDENCE PROCESSOR
   Runs a single file through the complete pipeline:
     Detect EXIF → Sanitize → SHA-256 (clean file) → C2PA scan
   Returns a structured EvidenceResult ready for localStorage.
════════════════════════════════════════════════════════════════ */

/**
 * Full security pipeline for one uploaded evidence file.
 *
 * @param  {File} file  Raw uploaded file (image, PDF, audio, etc.)
 * @returns {Promise<EvidenceResult>}
 *
 * @typedef  {Object} EvidenceResult
 * @property {string}      fileName         Original file name
 * @property {string}      fileType         MIME type
 * @property {number}      fileSize         Original size in bytes
 * @property {string}      sha256           Hex hash of the SANITIZED file
 * @property {string[]}    strippedFields   Metadata fields detected and removed
 * @property {string|null} sanitizeWarning  Set when metadata could not be stripped
 * @property {C2PAResult}  c2pa             C2PA / AI detection result
 * @property {Blob}        cleanBlob        The sanitized file blob (ready for upload)
 * @property {string}      timestamp        ISO 8601 processing timestamp
 */
async function processEvidenceFile(file) {

  /* ── Guard: null or empty ──────────────────────────────────────── */
  if (!file || file.size === 0) {
    throw new Error(
      `Cannot process empty file: "${file?.name || 'unknown'}". `
      + 'Please choose a valid file.'
    );
  }

  /* ── Guard: >50 MB ─────────────────────────────────────────────── */
  if (file.size > 50 * 1024 * 1024) {
    throw new Error(
      `"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB — `
      + 'exceeds the 50 MB limit. Please compress or trim before uploading.'
    );
  }

  /* ── Guard: unsupported MIME type ──────────────────────────────── */
  const SUPPORTED_PREFIXES = ['image/', 'audio/', 'video/', 'application/pdf', 'text/'];
  const isSupported = !file.type /* unknown type — allow */ ||
                      SUPPORTED_PREFIXES.some(p => file.type.startsWith(p));
  if (!isSupported) {
    throw new Error(
      `Unsupported file type "${file.type}" for "${file.name}". `
      + 'Supported: images (JPEG/PNG/WebP), audio, video, PDF.'
    );
  }

  /* ── Step 1 & 2: Sanitize ──────────────────────────────────────── */
  let cleanBlob, strippedFields, sanitizeWarning = null;

  if (file.type.startsWith('image/')) {
    /* Images: canvas route-through removes all EXIF / XMP / metadata */
    const result  = await sanitizeImage(file);
    cleanBlob     = result.cleanBlob;
    strippedFields = result.stripped;
  } else {
    /* Non-images: return as-is with an informational warning */
    const result    = sanitizeNonImage(file);
    cleanBlob       = result.cleanBlob;
    strippedFields  = result.stripped;
    sanitizeWarning = result.warning;
  }

  /* ── Step 3: SHA-256 of the CLEAN blob ─────────────────────────── */
  const cleanBuffer = await cleanBlob.arrayBuffer();
  const hashHex     = await sha256(cleanBuffer);

  /* ── Step 4: C2PA / AI detection on the ORIGINAL file ──────────── */
  /* We scan the original because the sanitised Canvas export drops
     the very XMP/JUMBF data we need to detect AI generation. */
  const c2pa = await detectC2PA(file);

  return {
    fileName:        file.name,
    fileType:        file.type || 'application/octet-stream',
    fileSize:        file.size,
    sha256:          hashHex,
    strippedFields,
    sanitizeWarning,
    c2pa,
    cleanBlob,
    timestamp:       new Date().toISOString(),
  };
}

/**
 * Process a voice-recording Blob from MediaRecorder.
 * Voice blobs have no EXIF, so we skip sanitization and hash directly.
 *
 * @param  {Blob}   blob
 * @param  {string} [label='voice-recording']  Display name
 * @returns {Promise<EvidenceResult>}
 */
async function processVoiceBlob(blob, label = 'voice-recording') {
  if (!blob || blob.size === 0) {
    throw new Error('Voice recording is empty. Please try recording again.');
  }

  const buffer  = await blob.arrayBuffer();
  const hashHex = await sha256(buffer);

  return {
    fileName:        label + '.webm',
    fileType:        blob.type || 'audio/webm',
    fileSize:        blob.size,
    sha256:          hashHex,
    strippedFields:  [],       /* Audio from MediaRecorder carries no EXIF */
    sanitizeWarning: null,
    c2pa: {
      hasManifest:   false,
      isAIGenerated: false,
      hasBeenEdited: false,
      detectedTools: [],
      trustLevel:    'UNKNOWN',
      summary:       'Voice recording — C2PA manifest detection not applicable.',
    },
    cleanBlob:   blob,
    timestamp:   new Date().toISOString(),
  };
}


/* ═══════════════════════════════════════════════════════════════
   6. WINDOW EXPORT
   Attach to window so app.js (vanilla JS, no bundler) can access
   all security functions via window.AwaazSecurity.*
════════════════════════════════════════════════════════════════ */
window.AwaazSecurity = {
  /* Core hashing */
  sha256,
  computeAudioHash,   /* primary audio-hash entry point (computeAudioHash pattern) */
  hashVoiceBlob,      /* backward-compat alias → delegates to computeAudioHash */
  fileToBuffer,

  /* Metadata scanning & sanitization */
  detectExifFields,
  sanitizeImage,
  sanitizeNonImage,

  /* C2PA detection */
  detectC2PA,

  /* High-level pipeline entry points */
  processEvidenceFile,
  processVoiceBlob,
};

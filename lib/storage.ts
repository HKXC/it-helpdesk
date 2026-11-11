// Server-only access to the private Supabase Storage bucket for ticket images.
export const BUCKET = 'flowdesk-attachments';
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;
export const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function config() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw Error('Supabase configuration incomplete');
  const headers: Record<string, string> = { apikey: secret };
  if (secret.startsWith('eyJ')) headers.Authorization = 'Bearer ' + secret;
  return { url: url.replace(/\/$/, ''), headers };
}

const objectPath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export async function uploadObject(path: string, body: ArrayBuffer, type: string) {
  const { url, headers } = config();
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath(path)}`, {
    method: 'POST',
    headers: { ...headers, 'content-type': type, 'x-upsert': 'false' },
    body,
  });
  if (!r.ok) throw Error('Upload failed: ' + r.status);
}

export async function removeObject(path: string) {
  const { url, headers } = config();
  await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [path] }),
  });
}

export async function signedUrl(path: string, seconds = 300) {
  const { url, headers } = config();
  const r = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${objectPath(path)}`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: seconds }),
  });
  if (!r.ok) throw Error('Sign failed: ' + r.status);
  const data = (await r.json()) as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL || data.signedUrl;
  if (!signed) throw Error('Sign failed');
  return url + '/storage/v1' + signed;
}

// Check file signature so a renamed non-image cannot be stored as an image.
export function sniffImage(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return 'image/webp';
  return null;
}

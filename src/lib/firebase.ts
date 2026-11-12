import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function logOutUser() {
  return signOut(auth);
}

// Validation constants synchronized verbatim with firebase-blueprint.json
export const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export const ALLOWED_STRANDS = [
  'STEM',
  'ABM',
  'HUMSS',
  'GAS',
  'TVL-ICT',
  'TVL-HE',
  'TVL-IA',
  'BEC / RBEC',
  'SPA / SPS',
] as const;

export type AlumniStrand = (typeof ALLOWED_STRANDS)[number];

export const ALLOWED_EVENT_CATEGORIES = [
  'Homecoming',
  'Batch Reunion',
  'Career Mentorship',
  'Scholarship Drive',
  'Community Outreach',
] as const;

export type EventCategory = (typeof ALLOWED_EVENT_CATEGORIES)[number];

export const ALLOWED_ANNOUNCEMENT_CATEGORIES = [
  'Official Bulletin',
  'Scholarship Grant',
  'Campus Development',
  'Batch Milestone',
] as const;

export type AnnouncementCategory = (typeof ALLOWED_ANNOUNCEMENT_CATEGORIES)[number];

export const ALLOWED_MENTORSHIP_ROLES = ['none', 'mentor', 'mentee', 'both'] as const;
export type MentorshipRole = (typeof ALLOWED_MENTORSHIP_ROLES)[number];

export const ALLOWED_INDUSTRY_SECTORS = [
  'Engineering & Architecture',
  'Healthcare & Medicine',
  'Education & Academe',
  'IT, Software & Cybersecurity',
  'Finance, Accounting & Business',
  'Law & Public Administration',
  'Maritime & Logistics',
  'Hospitality & Culinary Arts',
] as const;

export type IndustrySector = (typeof ALLOWED_INDUSTRY_SECTORS)[number];

/**
 * Automatically returns the current calendar year (at least 2026) so Graduation Year
 * dropdowns and validators automatically advance every new year.
 */
export function getCurrentMaxGraduationYear(overrideMaxYear?: number): number {
  const sysYear = Math.max(new Date().getFullYear(), 2026);
  return overrideMaxYear && overrideMaxYear > sysYear ? overrideMaxYear : sysYear;
}

export interface BatchRangeOption {
  id: string;
  label: string;
  min: number;
  max: number;
  minYear: number;
  maxYear: number;
}

/**
 * Automatically generates batch range tabs (e.g., 2020-2026, and when the year reaches 2027+,
 * automatically creates 2027-2032, 2033-2038, etc.).
 */
export function generateDynamicBatchRanges(effectiveMaxYear: number): BatchRangeOption[] {
  const ranges: BatchRangeOption[] = [
    { id: '1982-1999', label: '1982–1999', min: 1982, max: 1999, minYear: 1982, maxYear: 1999 },
    { id: '2000-2009', label: '2000–2009', min: 2000, max: 2009, minYear: 2000, maxYear: 2009 },
    { id: '2010-2019', label: '2010–2019', min: 2010, max: 2019, minYear: 2010, maxYear: 2019 },
    { id: '2020-2026', label: '2020–2026', min: 2020, max: 2026, minYear: 2020, maxYear: 2026 },
  ];

  let nextStart = 2027;
  while (effectiveMaxYear >= nextStart) {
    const nextEnd = nextStart + 5; // 6-year block: 2027-2032, 2033-2038, etc.
    ranges.push({
      id: `${nextStart}-${nextEnd}`,
      label: `${nextStart}–${nextEnd}`,
      min: nextStart,
      max: nextEnd,
      minYear: nextStart,
      maxYear: nextEnd,
    });
    nextStart = nextEnd + 1;
  }

  return ranges.reverse();
}

/**
 * Converts Google Drive sharing links or standard image links into direct embeddable URLs.
 */
export function normalizeImageUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Handle Google Drive file links: https://drive.google.com/file/d/FILE_ID/view...
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;
  }

  // Handle Google Drive open/uc links: https://drive.google.com/open?id=FILE_ID
  const driveIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (trimmed.includes('drive.google.com') && driveIdMatch && driveIdMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveIdMatch[1]}`;
  }

  return trimmed.slice(0, 150000);
}

/**
 * Reads a local File and returns a compressed Data URL (< 140KB) suitable for Firestore storage.
 */
export function fileToCompressedDataUrl(
  file: File,
  maxDimension = 420,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read local image file.'));
    reader.onload = () => {
      const resultStr = String(reader.result || '');
      // Preserve animated GIFs directly if compact enough
      if (file.type === 'image/gif' && resultStr.length <= 145000) {
        resolve(resultStr);
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file selected.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(resultStr.slice(0, 145000));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed.slice(0, 148000));
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}

export function sanitizeString(val: string, maxLength: number): string {
  return val.trim().slice(0, maxLength);
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'doc_1';
}

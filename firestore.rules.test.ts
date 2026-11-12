/**
 * Security Rules Audit & Dirty Dozen Verification Suite
 * Validates that all 12 adversarial payloads in security_spec.md are rejected by firestore.rules
 */

export interface SecurityAuditCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRuleGate: string;
}

export const DIRTY_DOZEN_TEST_CASES: SecurityAuditCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on AlumniProfile (isAdmin: true)',
    collection: 'alumni_profiles',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isValidAlumniProfile(data) -> data.keys().hasOnly([...])'
  },
  {
    id: 2,
    name: 'Identity Spoofing on AlumniProfile (uid mismatch)',
    collection: 'alumni_profiles',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isOwner(uid) && data.uid == request.auth.uid'
  },
  {
    id: 3,
    name: 'Unverified Admin Email Spoof Attack (email_verified == false)',
    collection: 'announcements',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isAdmin() -> isVerifiedUser() -> request.auth.token.email_verified == true'
  },
  {
    id: 4,
    name: 'Cross-User PII Read on /alumni_private/{uid}',
    collection: 'alumni_private',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isOwner(uid) || isAdmin()'
  },
  {
    id: 5,
    name: 'Unbounded List Scraping on /alumni_private',
    collection: 'alumni_private',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'allow list: if false'
  },
  {
    id: 6,
    name: 'Unfiltered Scraping of Private Alumni Profiles',
    collection: 'alumni_profiles',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: "existing().visibility == 'public' || (isSignedIn() && existing().uid == request.auth.uid)"
  },
  {
    id: 7,
    name: 'Denial-of-Wallet 1MB String Injection on bio',
    collection: 'alumni_profiles',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isValidAlumniProfile(incoming()) -> data.bio.size() <= 600'
  },
  {
    id: 8,
    name: 'ID Poisoning Attack on Document Path',
    collection: 'event_rsvps',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: "isValidId(rsvpId) -> id.matches('^[a-zA-Z0-9_\\\\-]+$')"
  },
  {
    id: 9,
    name: 'Temporal Forgery (Backdating createdAt)',
    collection: 'alumni_profiles',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().createdAt == request.time'
  },
  {
    id: 10,
    name: 'Immortal Field Mutation (createdAt tampering on Update)',
    collection: 'alumni_profiles',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().createdAt == existing().createdAt && affectedKeys().hasOnly(...)'
  },
  {
    id: 11,
    name: 'Terminal State Bypass on Cancelled RSVP',
    collection: 'event_rsvps',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: "existing().status != 'cancelled'"
  },
  {
    id: 12,
    name: 'Privilege Escalation via Self-Write to /admins/{uid}',
    collection: 'admins',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'allow create: if isAdmin()'
  }
];

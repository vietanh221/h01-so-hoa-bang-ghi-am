/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 * Reference suite verifying data invariants for /users and /audioRecords.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  targetPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  rationale: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on AudioRecord Create',
    targetPath: '/audioRecords/rec_shadow_01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected by incoming().keys().hasOnly(...) in isValidAudioRecord().',
  },
  {
    id: 2,
    name: 'Self-Assigned Admin Role on UserProfile',
    targetPath: '/users/user_abc',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected because data.role == "contributor" is strictly enforced.',
  },
  {
    id: 3,
    name: 'OwnerId Identity Spoofing on Create',
    targetPath: '/audioRecords/rec_spoof_01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected because incoming().ownerId == request.auth.uid is required.',
  },
  {
    id: 4,
    name: 'ID Poisoning with Special Characters',
    targetPath: '/audioRecords/bad$id!with@chars',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected by isValidId(recordId) regex and size check.',
  },
  {
    id: 5,
    name: 'Unverified Email Write Attempt',
    targetPath: '/audioRecords/rec_unverified',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected by isVerifiedUser() requiring email_verified == true.',
  },
  {
    id: 6,
    name: 'Client Timestamp Spoofing on Create',
    targetPath: '/audioRecords/rec_time_01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected because createdAt == request.time and updatedAt == request.time.',
  },
  {
    id: 7,
    name: 'Immortal Field Mutation (ownerId / createdAt)',
    targetPath: '/audioRecords/rec_01',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected because ownerId and createdAt must match existing() and are excluded from affectedKeys.',
  },
  {
    id: 8,
    name: 'Unconstrained List Query Scraping',
    targetPath: '/audioRecords',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected unless query explicitly filters for public, verified community, or ownerId == auth.uid.',
  },
  {
    id: 9,
    name: 'Non-Owner Read on Private or Family Record',
    targetPath: '/audioRecords/rec_family_only',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected because private and family scopes restrict get to owner or verified admin.',
  },
  {
    id: 10,
    name: 'Waveform Array Exhaustion (Denial of Wallet)',
    targetPath: '/audioRecords/rec_array_bomb',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected by waveformPeaks.size() <= 64 and markers.size() <= 20.',
  },
  {
    id: 11,
    name: 'Type Poisoning on Update (string year)',
    targetPath: '/audioRecords/rec_01',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected because isValidAudioRecord(incoming()) runs before affectedKeys checks.',
  },
  {
    id: 12,
    name: 'Cross-User Deletion Attempt',
    targetPath: '/audioRecords/rec_01',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED',
    rationale: 'Rejected because delete requires existing().ownerId == request.auth.uid or isAdmin().',
  },
];

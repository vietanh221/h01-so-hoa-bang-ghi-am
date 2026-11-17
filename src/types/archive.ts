export type SourceFormat = 'cassette' | 'vinyl_cd' | 'reel_to_reel' | 'other';
export type PhysicalCondition = 'good' | 'fair' | 'fragile';
export type UsageScope = 'private' | 'family' | 'community' | 'public';
export type AudioMode = 'local_blob' | 'heritage_synth';
export type SynthPreset =
  | 'lullaby_1992'
  | 'radio_broadcast_1986'
  | 'village_festival_1998'
  | 'tet_letter_1995'
  | 'folk_strings_1989'
  | 'custom_tape';

export interface AudioMarker {
  timeSec: number;
  label: string;
}

export interface AudioRecordItem {
  id: string;
  accessionCode: string;
  title: string;
  speaker: string;
  year: number;
  location: string;
  sourceFormat: SourceFormat;
  physicalCondition: PhysicalCondition;
  description: string;
  durationSeconds: number;
  usageScope: UsageScope;
  usageNotes: string;
  audioMode: AudioMode;
  audioStorageKey: string;
  synthPreset: SynthPreset;
  waveformPeaks: number[];
  markers: AudioMarker[];
  ownerId: string;
  ownerName: string;
  createdAtMs: number;
  updatedAtMs: number;
  isCuratedDemo?: boolean;
}

/**
 * Validation constants synchronized verbatim with firebase-blueprint.json
 */
export const BLUEPRINT_CONSTRAINTS = {
  ACCESSION_CODE_MIN: 3,
  ACCESSION_CODE_MAX: 32,
  ACCESSION_CODE_PATTERN: /^[A-Za-z0-9-]+$/,
  TITLE_MIN: 2,
  TITLE_MAX: 140,
  SPEAKER_MIN: 2,
  SPEAKER_MAX: 100,
  YEAR_MIN: 1930,
  YEAR_MAX: 2026,
  LOCATION_MIN: 1,
  LOCATION_MAX: 120,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 2000,
  DURATION_MIN: 1,
  DURATION_MAX: 14400,
  USAGE_NOTES_MAX: 500,
  AUDIO_STORAGE_KEY_MAX: 128,
  WAVEFORM_MAX_POINTS: 64,
  MARKERS_MAX: 20,
  MARKER_LABEL_MAX: 120,
  OWNER_NAME_MAX: 100,
} as const;

export const SOURCE_FORMAT_LABELS: Record<SourceFormat, string> = {
  cassette: 'Băng Cassette',
  vinyl_cd: 'Đĩa Than / CD Cũ',
  reel_to_reel: 'Băng Cối (Reel-to-Reel)',
  other: 'Tư liệu âm thanh khác',
};

export const CONDITION_LABELS: Record<PhysicalCondition, string> = {
  good: 'Tốt (băng phẳng, ít nhiễu)',
  fair: 'Trung bình (rè nhẹ / mốc nhẹ)',
  fragile: 'Xuống cấp nặng (cần số hoá khẩn)',
};

export const USAGE_SCOPE_META: Record<
  UsageScope,
  {
    label: string;
    shortLabel: string;
    summary: string;
    rightsRule: string;
  }
> = {
  private: {
    label: 'Riêng tư cá nhân',
    shortLabel: 'Riêng tư',
    summary: 'Chỉ chủ sở hữu tài khoản lưu trữ được nghe và quản lý.',
    rightsRule: 'Không chia sẻ ra ngoài; phục vụ bảo quản ký ức riêng tư hoặc nhật ký âm thanh.',
  },
  family: {
    label: 'Nội bộ gia đình',
    shortLabel: 'Gia đình',
    summary: 'Lưu hành trong phạm vi gia đình, dòng họ; không đăng tải công khai.',
    rightsRule: 'Được phép sao chép cho thân nhân; cần sự đồng thuận của người đại diện gia đình nếu trích dẫn.',
  },
  community: {
    label: 'Cộng đồng địa phương',
    shortLabel: 'Cộng đồng',
    summary: 'Phục vụ sinh hoạt văn hoá thôn, xã, phường hoặc nhóm cộng đồng đã đăng nhập.',
    rightsRule: 'Cho phép nghe trực tuyến và sử dụng trong trưng bày văn hoá cộng đồng, bắt buộc ghi rõ nguồn.',
  },
  public: {
    label: 'Công khai nghiên cứu',
    shortLabel: 'Công khai',
    summary: 'Mở truy cập cho công chúng, sinh viên và nhà nghiên cứu di sản nghe nhìn.',
    rightsRule: 'Phát hành theo nguyên tắc phi thương mại; yêu cầu ghi công người nói và đơn vị lưu trữ.',
  },
};

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

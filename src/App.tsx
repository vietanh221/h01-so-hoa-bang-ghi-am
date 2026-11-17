import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  Globe,
  Headphones,
  Home,
  Lock,
  LogIn,
  LogOut,
  Pause,
  Play,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { AboutTopicSection } from './components/AboutTopicSection';
import { AudioPlayerDrawer } from './components/AudioPlayerDrawer';
import { ConversionGuideSection } from './components/ConversionGuideSection';
import { DigitizeStudioModal } from './components/DigitizeStudioModal';
import { TopBar } from './components/TopBar';
import { UsageScopeSection } from './components/UsageScopeSection';
import { CURATED_DEMO_RECORDS } from './data/curatedArchive';
import { deleteAudioBlob } from './lib/audioBlobStore';
import {
  auth,
  db,
  ensureUserProfile,
  handleFirestoreError,
  OperationType,
  signInWithGoogleContributor,
  signOutContributor,
  testConnection,
} from './lib/firebase';
import { audioEngine, type PlaybackSnapshot } from './lib/heritageAudioEngine';
import {
  formatDuration,
  SOURCE_FORMAT_LABELS,
  USAGE_SCOPE_META,
  type AudioMarker,
  type AudioRecordItem,
  type PhysicalCondition,
  type SourceFormat,
  type SynthPreset,
  type UsageScope,
} from './types/archive';

function timestampToMs(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val) {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
}

function mapSnapshotDoc(id: string, data: Record<string, unknown>): AudioRecordItem {
  return {
    id,
    accessionCode: String(data.accessionCode || 'H01-000'),
    title: String(data.title || ''),
    speaker: String(data.speaker || ''),
    year: Number(data.year || 1990),
    location: String(data.location || ''),
    sourceFormat: (data.sourceFormat as SourceFormat) || 'cassette',
    physicalCondition: (data.physicalCondition as PhysicalCondition) || 'fair',
    description: String(data.description || ''),
    durationSeconds: Number(data.durationSeconds || 60),
    usageScope: (data.usageScope as UsageScope) || 'private',
    usageNotes: String(data.usageNotes || ''),
    audioMode: (data.audioMode as 'local_blob' | 'heritage_synth') || 'heritage_synth',
    audioStorageKey: String(data.audioStorageKey || ''),
    synthPreset: (data.synthPreset as SynthPreset) || 'custom_tape',
    waveformPeaks: Array.isArray(data.waveformPeaks)
      ? data.waveformPeaks.map(Number)
      : [0.3, 0.5, 0.4, 0.6],
    markers: Array.isArray(data.markers)
      ? (data.markers as AudioMarker[]).map((m) => ({
          timeSec: Number(m.timeSec || 0),
          label: String(m.label || ''),
        }))
      : [],
    ownerId: String(data.ownerId || ''),
    ownerName: String(data.ownerName || 'Người đóng góp'),
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
    isCuratedDemo: false,
  };
}

function ScopeIconSmall({ scope }: { scope: UsageScope }) {
  switch (scope) {
    case 'private':
      return <Lock className="w-3.5 h-3.5 text-[#8C3B1E]" />;
    case 'family':
      return <Home className="w-3.5 h-3.5 text-[#8C3B1E]" />;
    case 'community':
      return <Users className="w-3.5 h-3.5 text-[#2C4A52]" />;
    case 'public':
      return <Globe className="w-3.5 h-3.5 text-[#2C4A52]" />;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [publicDocs, setPublicDocs] = useState<AudioRecordItem[]>([]);
  const [communityDocs, setCommunityDocs] = useState<AudioRecordItem[]>([]);
  const [myDocs, setMyDocs] = useState<AudioRecordItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | UsageScope>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | SourceFormat>('all');
  const [onlyMine, setOnlyMine] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<AudioRecordItem | null>(null);
  const [activeAudioRecordId, setActiveAudioRecordId] = useState<string | null>(null);
  const [playbackSnap, setPlaybackSnap] = useState<PlaybackSnapshot>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    noiseReduction: true,
    volume: 0.85,
    sourceNotice: null,
  });

  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AudioRecordItem | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  useEffect(() => {
    void testConnection();
    const unsubAudio = audioEngine.subscribe(setPlaybackSnap);
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        void ensureUserProfile(currentUser);
      } else {
        setCommunityDocs([]);
        setMyDocs([]);
        setOnlyMine(false);
      }
    });
    return () => {
      unsubAudio();
      unsubAuth();
    };
  }, []);

  // Public Firestore listener (allowed for all visitors via usageScope == 'public')
  useEffect(() => {
    const qPublic = query(collection(db, 'audioRecords'), where('usageScope', '==', 'public'));
    const unsub = onSnapshot(
      qPublic,
      (snapshot) => {
        setPublicDocs(snapshot.docs.map((d) => mapSnapshotDoc(d.id, d.data())));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'audioRecords?usageScope=public');
      }
    );
    return unsub;
  }, []);

  // Community & Own Records listeners (only when authenticated & verified)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      return;
    }

    const qCommunity = query(
      collection(db, 'audioRecords'),
      where('usageScope', '==', 'community')
    );
    const unsubCommunity = onSnapshot(
      qCommunity,
      (snapshot) => {
        setCommunityDocs(snapshot.docs.map((d) => mapSnapshotDoc(d.id, d.data())));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'audioRecords?usageScope=community');
      }
    );

    const qMine = query(collection(db, 'audioRecords'), where('ownerId', '==', user.uid));
    const unsubMine = onSnapshot(
      qMine,
      (snapshot) => {
        setMyDocs(snapshot.docs.map((d) => mapSnapshotDoc(d.id, d.data())));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `audioRecords?ownerId=${user.uid}`);
      }
    );

    return () => {
      unsubCommunity();
      unsubMine();
    };
  }, [authReady, user]);

  // Merge Firestore documents with curated baseline exhibition records
  const allRecords = useMemo(() => {
    const byId = new Map<string, AudioRecordItem>();
    CURATED_DEMO_RECORDS.forEach((rec) => byId.set(rec.id, rec));
    publicDocs.forEach((rec) => byId.set(rec.id, rec));
    communityDocs.forEach((rec) => byId.set(rec.id, rec));
    myDocs.forEach((rec) => byId.set(rec.id, rec));
    return Array.from(byId.values()).sort((a, b) => b.year - a.year || b.createdAtMs - a.createdAtMs);
  }, [publicDocs, communityDocs, myDocs]);

  const countsByScope = useMemo(() => {
    const counts: Record<UsageScope, number> = {
      private: 0,
      family: 0,
      community: 0,
      public: 0,
    };
    allRecords.forEach((r) => {
      counts[r.usageScope]++;
    });
    return counts;
  }, [allRecords]);

  const totalDurationMinutes = useMemo(() => {
    const totalSec = allRecords.reduce((acc, r) => acc + r.durationSeconds, 0);
    return Math.round(totalSec / 60);
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRecords.filter((rec) => {
      if (onlyMine && (!user || rec.ownerId !== user.uid)) return false;
      if (scopeFilter !== 'all' && rec.usageScope !== scopeFilter) return false;
      if (formatFilter !== 'all' && rec.sourceFormat !== formatFilter) return false;
      if (!q) return true;
      return (
        rec.title.toLowerCase().includes(q) ||
        rec.speaker.toLowerCase().includes(q) ||
        rec.description.toLowerCase().includes(q) ||
        rec.location.toLowerCase().includes(q) ||
        rec.accessionCode.toLowerCase().includes(q) ||
        String(rec.year).includes(q)
      );
    });
  }, [allRecords, onlyMine, user, scopeFilter, formatFilter, searchQuery]);

  const activeAudioRecord = useMemo(
    () => allRecords.find((r) => r.id === activeAudioRecordId) || null,
    [allRecords, activeAudioRecordId]
  );

  const handleSignIn = async () => {
    setAuthNotice(null);
    try {
      await signInWithGoogleContributor();
    } catch (err) {
      setAuthNotice(
        err instanceof Error
          ? err.message
          : 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.'
      );
    }
  };

  const handlePlayRecord = async (record: AudioRecordItem, openDrawer = true) => {
    if (openDrawer) {
      setSelectedRecord(record);
    }
    if (activeAudioRecordId === record.id) {
      audioEngine.togglePlay();
      return;
    }
    setActiveAudioRecordId(record.id);
    await audioEngine.loadRecord(record, true);
  };

  const handleSaveRecord = async (payload: {
    id?: string;
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
    audioMode: 'local_blob' | 'heritage_synth';
    audioStorageKey: string;
    synthPreset: SynthPreset;
    waveformPeaks: number[];
    markers: AudioMarker[];
  }) => {
    if (!user) throw new Error('Bạn cần đăng nhập trước khi lưu bản ghi.');
    const ownerName = (user.displayName || user.email?.split('@')[0] || 'Người đóng góp').slice(
      0,
      100
    );

    if (payload.id) {
      const targetPath = `audioRecords/${payload.id}`;
      try {
        await updateDoc(doc(db, 'audioRecords', payload.id), {
          accessionCode: payload.accessionCode,
          title: payload.title,
          speaker: payload.speaker,
          year: payload.year,
          location: payload.location,
          sourceFormat: payload.sourceFormat,
          physicalCondition: payload.physicalCondition,
          description: payload.description,
          durationSeconds: payload.durationSeconds,
          usageScope: payload.usageScope,
          usageNotes: payload.usageNotes,
          audioMode: payload.audioMode,
          audioStorageKey: payload.audioStorageKey,
          synthPreset: payload.synthPreset,
          waveformPeaks: payload.waveformPeaks,
          markers: payload.markers,
          ownerName,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, targetPath);
      }
    } else {
      const colPath = 'audioRecords';
      try {
        await addDoc(collection(db, 'audioRecords'), {
          accessionCode: payload.accessionCode,
          title: payload.title,
          speaker: payload.speaker,
          year: payload.year,
          location: payload.location,
          sourceFormat: payload.sourceFormat,
          physicalCondition: payload.physicalCondition,
          description: payload.description,
          durationSeconds: payload.durationSeconds,
          usageScope: payload.usageScope,
          usageNotes: payload.usageNotes,
          audioMode: payload.audioMode,
          audioStorageKey: payload.audioStorageKey,
          synthPreset: payload.synthPreset,
          waveformPeaks: payload.waveformPeaks,
          markers: payload.markers,
          ownerId: user.uid,
          ownerName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, colPath);
      }
    }
  };

  const handleDeleteRecord = async (record: AudioRecordItem) => {
    if (record.isCuratedDemo) return;
    const targetPath = `audioRecords/${record.id}`;
    try {
      await deleteDoc(doc(db, 'audioRecords', record.id));
      if (record.audioStorageKey) {
        await deleteAudioBlob(record.audioStorageKey);
      }
      if (selectedRecord?.id === record.id) {
        setSelectedRecord(null);
      }
      if (activeAudioRecordId === record.id) {
        audioEngine.pause();
        setActiveAudioRecordId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, targetPath);
    }
  };

  const canManageRecord = (record: AudioRecordItem) => {
    if (record.isCuratedDemo || !user) return false;
    return record.ownerId === user.uid || user.email === 'anhtaotenduong@gmail.com';
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      <TopBar
        onOpenRegisterModal={() => {
          setEditingRecord(null);
          setIsStudioOpen(true);
        }}
      />

      <main className="flex-1">
        {/* Hero Exhibition Split */}
        <section className="pt-10 pb-12 md:pt-14 md:pb-16">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch mb-10">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <p className="text-xs font-mono tracking-widest uppercase text-[#6B655E] mb-3">
                  Đề tài H01 · Di sản tư liệu nghe nhìn · Phạm Việt Anh (PH59336)
                </p>
                <h1 className="text-4xl md:text-5xl font-serif font-semibold text-[#1C1917] leading-[1.15] [text-wrap:balance] mb-5">
                  Số hoá băng ghi âm trong gia đình và cộng đồng
                </h1>
                <p className="text-base md:text-lg text-[#44403C] leading-relaxed mb-7 max-w-xl">
                  Chuyển băng cassette, băng cối và đĩa cũ sang tệp số bền vững; lưu giữ đầy đủ
                  người nói, năm ghi âm, mô tả nội dung, nghe trực tuyến và thiết lập rõ phạm vi
                  được phép dùng.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href="#kho-ban-ghi"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] rounded-lg hover:bg-[#332E2A] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Headphones className="w-4 h-4" />
                    <span>Nghe kho bản ghi</span>
                  </a>
                  <a
                    href="#huong-dan-chuyen-doi"
                    className="inline-flex items-center px-5 py-2.5 text-sm font-medium border border-[#D6CEBE] bg-[#F2EFE9] text-[#1C1917] rounded-lg hover:bg-[#EBE6DF] transition-colors whitespace-nowrap shrink-0"
                  >
                    Hướng dẫn chuyển đổi
                  </a>
                </div>
              </div>

              <div className="lg:col-span-6">
                <figure className="h-full flex flex-col">
                  <div className="overflow-hidden rounded-xl border border-[#E0D9CE] bg-[#EBE6DF] flex-1 min-h-[280px]">
                    <img
                      src="/src/assets/images/hero_cassette_workbench_1794926082758.jpg"
                      alt="Bàn làm việc số hoá băng cassette cổ điển với đầu đọc, bộ chuyển đổi âm thanh và băng ghi nhãn viết tay"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <figcaption className="text-xs font-serif italic text-[#6B655E] mt-2">
                    Bàn số hoá tư liệu âm thanh gia đình: đầu phát cassette deck kết nối bộ giải mã
                    số để bảo tồn tệp chủ 24-bit.
                  </figcaption>
                </figure>
              </div>
            </div>

            {/* Operational Utility Strip (4-column full-width below hero split) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-b border-[#E0D9CE] divide-y lg:divide-y-0 lg:divide-x divide-[#E0D9CE]">
              <div className="py-4 lg:px-5 first:pl-0">
                <span className="block text-xs text-[#6B655E] mb-1">Số bản ghi trong kho</span>
                <span className="text-2xl font-serif font-semibold text-[#1C1917] tabular-nums">
                  {allRecords.length} thẻ tư liệu
                </span>
              </div>
              <div className="py-4 px-4 lg:px-5">
                <span className="block text-xs text-[#6B655E] mb-1">Tổng thời lượng lưu trữ</span>
                <span className="text-2xl font-serif font-semibold text-[#1C1917] tabular-nums">
                  {totalDurationMinutes} phút
                </span>
              </div>
              <div className="py-4 lg:px-5">
                <span className="block text-xs text-[#6B655E] mb-1">Chuẩn lưu trữ khuyên dùng</span>
                <span className="text-2xl font-serif font-semibold text-[#1C1917] tabular-nums">
                  WAV 24-bit / 48kHz
                </span>
              </div>
              <div className="py-4 px-4 lg:px-5 last:pr-0">
                <span className="block text-xs text-[#6B655E] mb-1">Phân cấp phạm vi dùng</span>
                <span className="text-2xl font-serif font-semibold text-[#1C1917] tabular-nums">
                  4 mức bảo vệ
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Archive Catalog Section ("Kho Bản Ghi") */}
        <section id="kho-ban-ghi" className="py-14 md:py-16 border-t border-[#E0D9CE]">
          <div className="max-w-[1200px] mx-auto px-6">
            {/* Section Title + Contributor Auth Bar */}
            <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
              <div className="max-w-xl">
                <p className="text-xs font-mono tracking-widest uppercase text-[#6B655E] mb-2">
                  Danh mục tư liệu nghe nhìn
                </p>
                <h2 className="text-3xl md:text-4xl font-serif font-semibold text-[#1C1917] [text-wrap:balance]">
                  Kho thẻ bản ghi & Nghe trực tuyến
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {user ? (
                  <>
                    <span className="text-xs text-[#57534E]">
                      Tài khoản: <strong className="text-[#1C1917]">{user.displayName || user.email}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setOnlyMine((v) => !v)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        onlyMine
                          ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                          : 'bg-[#F2EFE9] text-[#44403C] border-[#D6CEBE] hover:text-[#1C1917]'
                      }`}
                    >
                      Bản ghi của tôi ({myDocs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => void signOutContributor()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#57534E] border border-[#E0D9CE] rounded-lg hover:text-[#1C1917] cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSignIn()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#F2EFE9] border border-[#D6CEBE] text-[#1C1917] rounded-lg hover:bg-[#EBE6DF] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-3.5 h-3.5 text-[#8C3B1E]" />
                    <span>Đăng nhập Google để lưu bản ghi</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setIsStudioOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#8C3B1E] text-[#FBF9F5] rounded-lg hover:bg-[#732E15] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm bản ghi mới</span>
                </button>
              </div>
            </div>

            {authNotice && (
              <div className="mb-6 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                {authNotice}
              </div>
            )}

            {/* Workspace Filter & Search Toolbar */}
            <div className="bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl p-4 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#6B655E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên bản ghi, người nói, năm, địa điểm..."
                  aria-label="Tìm kiếm bản ghi"
                  className="w-full pl-10 pr-4 py-2 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] placeholder:text-[#8C857B] focus:outline-none focus:border-[#8C3B1E]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Interactive Segmented Control for Scope */}
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EBE6DF] rounded-lg">
                  {(
                    [
                      { id: 'all', label: 'Tất cả' },
                      { id: 'public', label: 'Công khai' },
                      { id: 'community', label: 'Cộng đồng' },
                      { id: 'family', label: 'Gia đình' },
                      { id: 'private', label: 'Riêng tư' },
                    ] as const
                  ).map((tab) => {
                    const active = scopeFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setScopeFilter(tab.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[#FBF9F5] text-[#1C1917]'
                            : 'text-[#57534E] hover:text-[#1C1917]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Format Select */}
                <select
                  aria-label="Lọc theo vật mang tin gốc"
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value as 'all' | SourceFormat)}
                  className="px-3 py-2 text-xs font-medium bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] cursor-pointer"
                >
                  <option value="all">Mọi định dạng gốc</option>
                  <option value="cassette">Băng Cassette</option>
                  <option value="vinyl_cd">Đĩa Than / CD Cũ</option>
                  <option value="reel_to_reel">Băng Cối</option>
                  <option value="other">Tư liệu khác</option>
                </select>
              </div>
            </div>

            {/* Record Cards Grid */}
            {filteredRecords.length === 0 ? (
              <div className="py-16 px-6 text-center bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl">
                <p className="text-base font-serif font-medium text-[#1C1917] mb-2">
                  Không tìm thấy bản ghi phù hợp với bộ lọc hiện tại
                </p>
                <p className="text-sm text-[#57534E] mb-5">
                  Thử xoá từ khoá tìm kiếm hoặc chuyển sang nhóm phạm vi khác, hoặc tự đăng ký một
                  bản ghi mới.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setScopeFilter('all');
                    setFormatFilter('all');
                    setOnlyMine(false);
                  }}
                  className="px-4 py-2 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] rounded-lg hover:bg-[#332E2A] cursor-pointer"
                >
                  Hiển thị toàn bộ kho bản ghi
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRecords.map((record) => {
                  const isCurrentlyPlaying =
                    activeAudioRecordId === record.id && playbackSnap.isPlaying;
                  const scopeMeta = USAGE_SCOPE_META[record.usageScope];

                  return (
                    <article
                      key={record.id}
                      className="bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl p-6 flex flex-col justify-between hover:border-[#C7BEB0] transition-colors"
                    >
                      <div>
                        {/* Zero-pill unboxed metadata line */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#6B655E] mb-3">
                          <span className="text-[#8C3B1E] font-medium">{record.accessionCode}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{record.year}</span>
                          <span aria-hidden="true">·</span>
                          <span>{SOURCE_FORMAT_LABELS[record.sourceFormat]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatDuration(record.durationSeconds)}</span>
                        </div>

                        <h3 className="text-xl font-serif font-semibold text-[#1C1917] leading-snug mb-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(record)}
                            className="text-left hover:text-[#8C3B1E] transition-colors cursor-pointer"
                          >
                            {record.title}
                          </button>
                        </h3>

                        <p className="text-xs font-medium text-[#44403C] mb-3">
                          Người nói: <span className="text-[#1C1917]">{record.speaker}</span>
                        </p>

                        <p className="text-sm text-[#57534E] leading-relaxed line-clamp-3 mb-5">
                          {record.description}
                        </p>
                      </div>

                      <div>
                        {/* Mini Static Waveform Preview */}
                        <div
                          aria-hidden="true"
                          className="h-8 flex items-end gap-[2px] mb-4 opacity-80"
                        >
                          {record.waveformPeaks.slice(0, 32).map((p, idx) => (
                            <div
                              key={idx}
                              style={{ height: `${Math.max(16, Math.round(p * 100))}%` }}
                              className={`flex-1 rounded-xs ${
                                isCurrentlyPlaying ? 'bg-[#8C3B1E]' : 'bg-[#B8AFA0]'
                              }`}
                            />
                          ))}
                        </div>

                        {/* Card Footer: Usage Scope + Play Action */}
                        <div className="pt-4 border-t border-[#E0D9CE] flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#44403C] min-w-0">
                            <ScopeIconSmall scope={record.usageScope} />
                            <span className="truncate">{scopeMeta.shortLabel}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(record)}
                              className="px-2.5 py-1.5 text-xs font-medium text-[#44403C] hover:text-[#1C1917] cursor-pointer whitespace-nowrap"
                            >
                              Hồ sơ
                            </button>
                            <button
                              type="button"
                              onClick={() => void handlePlayRecord(record, true)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] rounded-lg hover:bg-[#8C3B1E] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {isCurrentlyPlaying ? (
                                <>
                                  <Pause className="w-3.5 h-3.5" />
                                  <span>Đang phát</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5" />
                                  <span>Nghe</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <ConversionGuideSection />

        <UsageScopeSection
          countsByScope={countsByScope}
          activeScopeFilter={scopeFilter}
          onSelectScope={(scope) => setScopeFilter(scope)}
        />

        <AboutTopicSection />
      </main>

      {/* Docked Mini Playback Bar (only when active audio exists & drawer is closed) */}
      {activeAudioRecord && !selectedRecord && (
        <div className="sticky bottom-0 z-40 bg-[#1C1917] text-[#FBF9F5] border-t border-[#332E2A]">
          <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setSelectedRecord(activeAudioRecord)}
              className="min-w-0 text-left cursor-pointer group"
            >
              <span className="block text-xs font-mono text-[#D6CEBE] truncate">
                {activeAudioRecord.accessionCode} · {activeAudioRecord.speaker}
              </span>
              <span className="block text-sm font-medium truncate group-hover:underline">
                {activeAudioRecord.title}
              </span>
            </button>

            <div className="flex items-center gap-4 shrink-0">
              <span className="hidden sm:inline text-xs font-mono text-[#D6CEBE] tabular-nums">
                {formatDuration(playbackSnap.currentTime)} /{' '}
                {formatDuration(playbackSnap.duration || activeAudioRecord.durationSeconds)}
              </span>
              <button
                type="button"
                onClick={() => audioEngine.togglePlay()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#8C3B1E] text-[#FBF9F5] rounded-lg hover:bg-[#732E15] cursor-pointer whitespace-nowrap"
              >
                {playbackSnap.isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Tạm dừng</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Phát tiếp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiet Archival Footer */}
      <footer className="border-t border-[#E0D9CE] py-8 bg-[#FBF9F5]">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#6B655E]">
          <p>
            Ký Ức Băng Từ — Đề tài H01: Số hoá băng ghi âm trong gia đình và cộng đồng · Sinh viên
            Phạm Việt Anh (PH59336)
          </p>
          <div className="flex items-center gap-5">
            <a href="#kho-ban-ghi" className="hover:text-[#1C1917]">
              Kho Bản Ghi
            </a>
            <a href="#huong-dan-chuyen-doi" className="hover:text-[#1C1917]">
              Hướng Dẫn
            </a>
            <a href="#pham-vi-su-dung" className="hover:text-[#1C1917]">
              Phạm Vi Dùng
            </a>
          </div>
        </div>
      </footer>

      {/* Museum Accession & Player Drawer */}
      <AudioPlayerDrawer
        record={selectedRecord}
        isActiveAudio={Boolean(selectedRecord && activeAudioRecordId === selectedRecord.id)}
        canManage={selectedRecord ? canManageRecord(selectedRecord) : false}
        onClose={() => setSelectedRecord(null)}
        onRequestPlay={(seekSec) => {
          if (!selectedRecord) return;
          if (activeAudioRecordId === selectedRecord.id) {
            if (typeof seekSec === 'number') {
              audioEngine.seek(seekSec);
              if (!playbackSnap.isPlaying) void audioEngine.play();
            } else {
              audioEngine.togglePlay();
            }
          } else {
            setActiveAudioRecordId(selectedRecord.id);
            void audioEngine.loadRecord(selectedRecord, true).then(() => {
              if (typeof seekSec === 'number') {
                audioEngine.seek(seekSec);
              }
            });
          }
        }}
        onEdit={(rec) => {
          setSelectedRecord(null);
          setEditingRecord(rec);
          setIsStudioOpen(true);
        }}
        onDelete={(rec) => void handleDeleteRecord(rec)}
      />

      {/* Digitization & Registration Modal */}
      <DigitizeStudioModal
        isOpen={isStudioOpen}
        user={user}
        editingRecord={editingRecord}
        onSignIn={handleSignIn}
        onClose={() => {
          setIsStudioOpen(false);
          setEditingRecord(null);
        }}
        onSaveRecord={handleSaveRecord}
      />
    </div>
  );
}

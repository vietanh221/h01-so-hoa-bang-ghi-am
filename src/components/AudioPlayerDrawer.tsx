import React, { useEffect, useState } from 'react';
import {
  Download,
  Edit3,
  Globe,
  Home,
  Lock,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import { audioEngine, type PlaybackSnapshot } from '../lib/heritageAudioEngine';
import {
  CONDITION_LABELS,
  formatDuration,
  SOURCE_FORMAT_LABELS,
  USAGE_SCOPE_META,
  type AudioRecordItem,
  type UsageScope,
} from '../types/archive';

interface AudioPlayerDrawerProps {
  record: AudioRecordItem | null;
  isActiveAudio: boolean;
  canManage: boolean;
  onClose: () => void;
  onRequestPlay: (seekSec?: number) => void;
  onEdit: (record: AudioRecordItem) => void;
  onDelete: (record: AudioRecordItem) => void;
}

function ScopeIcon({ scope }: { scope: UsageScope }) {
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

export const AudioPlayerDrawer: React.FC<AudioPlayerDrawerProps> = ({
  record,
  isActiveAudio,
  canManage,
  onClose,
  onRequestPlay,
  onEdit,
  onDelete,
}) => {
  const [snap, setSnap] = useState<PlaybackSnapshot>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    noiseReduction: true,
    volume: 0.85,
    sourceNotice: null,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const unsub = audioEngine.subscribe(setSnap);
    return unsub;
  }, []);

  useEffect(() => {
    setConfirmDelete(false);
  }, [record?.id]);

  if (!record) return null;

  const isThisPlaying = isActiveAudio && snap.isPlaying;
  const currentTime = isActiveAudio ? snap.currentTime : 0;
  const duration =
    isActiveAudio && snap.duration > 0 ? snap.duration : record.durationSeconds;
  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const scopeInfo = USAGE_SCOPE_META[record.usageScope];

  const handleExportCard = () => {
    const payload = {
      accessionCode: record.accessionCode,
      title: record.title,
      speaker: record.speaker,
      year: record.year,
      location: record.location,
      sourceFormat: SOURCE_FORMAT_LABELS[record.sourceFormat],
      physicalCondition: CONDITION_LABELS[record.physicalCondition],
      durationSeconds: record.durationSeconds,
      usageScope: scopeInfo.label,
      usageNotes: record.usageNotes,
      description: record.description,
      markers: record.markers,
      exportedAt: new Date().toISOString(),
      project: 'H01 - Số hoá băng ghi âm trong gia đình và cộng đồng',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.accessionCode || 'ban-ghi'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chi tiết bản ghi ${record.title}`}
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/45 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl h-full bg-[#FBF9F5] border-l border-[#E0D9CE] overflow-y-auto p-6 md:p-8 flex flex-col justify-between">
        <div>
          {/* Top bar of drawer */}
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#E0D9CE]">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#6B655E] mb-1.5">
                <span className="text-[#8C3B1E] font-medium">{record.accessionCode}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Năm {record.year}</span>
                <span aria-hidden="true">·</span>
                <span>{SOURCE_FORMAT_LABELS[record.sourceFormat]}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-serif font-semibold text-[#1C1917] leading-snug [text-wrap:balance]">
                {record.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trình nghe bản ghi"
              className="p-2 rounded-lg border border-[#E0D9CE] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F2EFE9] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Online Audio Player Console */}
          <div className="my-6 bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-medium text-[#6B655E]">Trình nghe trực tuyến</p>
                <p className="text-sm font-semibold text-[#1C1917]">
                  Người nói: {record.speaker}
                </p>
              </div>
              <button
                type="button"
                onClick={() => audioEngine.toggleNoiseReduction()}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  snap.noiseReduction
                    ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                    : 'bg-[#FBF9F5] text-[#57534E] border-[#D6CEBE] hover:text-[#1C1917]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Lọc nhiễu băng từ: {snap.noiseReduction ? 'Bật' : 'Tắt'}</span>
              </button>
            </div>

            {/* Interactive Waveform Scrubber */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Thanh tiến trình âm thanh"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const targetSec = ratio * duration;
                if (!isActiveAudio) {
                  onRequestPlay(targetSec);
                } else {
                  audioEngine.seek(targetSec);
                }
              }}
              onKeyDown={(e) => {
                if (!isActiveAudio) return;
                if (e.key === 'ArrowRight') audioEngine.seek(currentTime + 5);
                if (e.key === 'ArrowLeft') audioEngine.seek(currentTime - 5);
              }}
              className="h-20 flex items-end gap-[3px] px-2 py-2 bg-[#FBF9F5] border border-[#E0D9CE] rounded-lg cursor-pointer select-none mb-3"
            >
              {record.waveformPeaks.map((peak, idx) => {
                const barRatio = idx / record.waveformPeaks.length;
                const passed = barRatio <= progressRatio;
                return (
                  <div
                    key={idx}
                    style={{ height: `${Math.max(14, Math.round(peak * 100))}%` }}
                    className={`flex-1 rounded-sm transition-colors ${
                      passed ? 'bg-[#8C3B1E]' : 'bg-[#D6CEBE]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Time + Transport Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => isActiveAudio && audioEngine.seek(currentTime - 10)}
                  aria-label="Tua lùi 10 giây"
                  className="p-2 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] text-[#44403C] hover:text-[#1C1917] cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRequestPlay()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8C3B1E] text-[#FBF9F5] hover:bg-[#732E15] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isThisPlaying ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Tạm dừng</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Phát bản ghi</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => isActiveAudio && audioEngine.seek(currentTime + 10)}
                  aria-label="Tua tới 10 giây"
                  className="p-2 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] text-[#44403C] hover:text-[#1C1917] cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 p-0.5 bg-[#EBE6DF] rounded-md">
                  {[0.75, 1, 1.25].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => audioEngine.setPlaybackRate(rate)}
                      className={`px-2 py-1 text-xs font-mono rounded transition-colors cursor-pointer tabular-nums ${
                        snap.playbackRate === rate
                          ? 'bg-[#FBF9F5] text-[#1C1917]'
                          : 'text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#57534E]" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={snap.volume}
                    onChange={(e) => audioEngine.setVolume(Number(e.target.value))}
                    aria-label="Âm lượng"
                    className="w-16 accent-[#8C3B1E] cursor-pointer"
                  />
                </div>

                <span className="text-xs font-mono text-[#44403C] tabular-nums whitespace-nowrap">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>
            </div>

            {isActiveAudio && snap.sourceNotice && (
              <p className="mt-3 text-xs text-[#6B655E] leading-relaxed">{snap.sourceNotice}</p>
            )}
          </div>

          {/* Timestamped Content Markers */}
          {record.markers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#1C1917] mb-2.5">
                Mốc nội dung theo thời gian
              </h3>
              <div className="border-t border-[#E0D9CE] divide-y divide-[#E0D9CE]">
                {record.markers.map((marker, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!isActiveAudio) {
                        onRequestPlay(marker.timeSec);
                      } else {
                        audioEngine.seek(marker.timeSec);
                        if (!snap.isPlaying) {
                          void audioEngine.play();
                        }
                      }
                    }}
                    className="w-full py-2.5 px-2 text-left flex items-center justify-between gap-3 hover:bg-[#F2EFE9] transition-colors cursor-pointer"
                  >
                    <span className="text-sm text-[#292524]">{marker.label}</span>
                    <span className="text-xs font-mono text-[#8C3B1E] tabular-nums shrink-0">
                      {formatDuration(marker.timeSec)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#1C1917] mb-2">Mô tả nội dung bản ghi</h3>
            <p className="text-sm text-[#44403C] leading-relaxed whitespace-pre-line">
              {record.description}
            </p>
          </div>

          {/* Museum Accession Metadata Grid */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#1C1917] mb-2">
              Hồ sơ biên mục & Phạm vi được phép dùng
            </h3>
            <dl className="border-t border-b border-[#E0D9CE] divide-y divide-[#E0D9CE]">
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Mã lưu trữ</dt>
                <dd className="col-span-2 text-sm font-mono text-[#1C1917]">
                  {record.accessionCode}
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Người nói / Nguồn âm</dt>
                <dd className="col-span-2 text-sm text-[#1C1917]">{record.speaker}</dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Năm ghi âm</dt>
                <dd className="col-span-2 text-sm font-mono tabular-nums text-[#1C1917]">
                  {record.year}
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Địa điểm / Bối cảnh</dt>
                <dd className="col-span-2 text-sm text-[#1C1917]">{record.location}</dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Vật mang tin gốc</dt>
                <dd className="col-span-2 text-sm text-[#1C1917]">
                  {SOURCE_FORMAT_LABELS[record.sourceFormat]} · {CONDITION_LABELS[record.physicalCondition]}
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Phạm vi được phép dùng</dt>
                <dd className="col-span-2">
                  <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1C1917] mb-1">
                    <ScopeIcon scope={record.usageScope} />
                    <span>{scopeInfo.label}</span>
                  </div>
                  <p className="text-xs text-[#57534E] leading-relaxed">{scopeInfo.rightsRule}</p>
                  {record.usageNotes && (
                    <p className="text-xs text-[#44403C] mt-1.5 leading-relaxed">
                      <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-[#8C3B1E]" />
                      {record.usageNotes}
                    </p>
                  )}
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Người số hoá</dt>
                <dd className="col-span-2 text-sm text-[#1C1917]">{record.ownerName}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#E0D9CE] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleExportCard}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#D6CEBE] bg-[#F2EFE9] text-[#1C1917] hover:bg-[#EBE6DF] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải phiếu tư liệu (JSON)</span>
          </button>

          {canManage && !record.isCuratedDemo && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(record)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] text-[#1C1917] hover:bg-[#F2EFE9] transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh sửa</span>
              </button>

              {confirmDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(record)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#991B1B] text-white hover:bg-[#7F1D1D] transition-colors cursor-pointer"
                >
                  <span>Xác nhận xoá</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E0D9CE] text-[#991B1B] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xoá bản ghi</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

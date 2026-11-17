import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Mic, Plus, Square, Trash2, Upload, X } from 'lucide-react';
import { extractAudioAnalysis, saveAudioBlob } from '../lib/audioBlobStore';
import {
  BLUEPRINT_CONSTRAINTS,
  formatDuration,
  USAGE_SCOPE_META,
  type AudioMarker,
  type AudioRecordItem,
  type PhysicalCondition,
  type SourceFormat,
  type SynthPreset,
  type UsageScope,
} from '../types/archive';

interface DigitizeStudioModalProps {
  isOpen: boolean;
  user: User | null;
  editingRecord: AudioRecordItem | null;
  onSignIn: () => Promise<void>;
  onClose: () => void;
  onSaveRecord: (payload: {
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
  }) => Promise<void>;
}

const DEFAULT_PEAKS = [
  0.28, 0.45, 0.62, 0.54, 0.71, 0.64, 0.48, 0.59, 0.76, 0.68, 0.52, 0.41,
  0.55, 0.69, 0.78, 0.63, 0.49, 0.58, 0.72, 0.61, 0.46, 0.38, 0.53, 0.67,
  0.74, 0.59, 0.44, 0.51, 0.65, 0.57, 0.42, 0.34, 0.47, 0.56, 0.43, 0.32,
];

export const DigitizeStudioModal: React.FC<DigitizeStudioModalProps> = ({
  isOpen,
  user,
  editingRecord,
  onSignIn,
  onClose,
  onSaveRecord,
}) => {
  const [captureTab, setCaptureTab] = useState<'upload' | 'mic' | 'metadata_only'>('upload');
  const [accessionCode, setAccessionCode] = useState('');
  const [title, setTitle] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [year, setYear] = useState<number>(1994);
  const [location, setLocation] = useState('');
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>('cassette');
  const [physicalCondition, setPhysicalCondition] = useState<PhysicalCondition>('fair');
  const [description, setDescription] = useState('');
  const [usageScope, setUsageScope] = useState<UsageScope>('family');
  const [usageNotes, setUsageNotes] = useState('');
  const [durationSeconds, setDurationSeconds] = useState<number>(120);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>(DEFAULT_PEAKS);
  const [markers, setMarkers] = useState<AudioMarker[]>([]);
  const [newMarkerTime, setNewMarkerTime] = useState<string>('00:15');
  const [newMarkerLabel, setNewMarkerLabel] = useState<string>('');

  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [existingStorageKey, setExistingStorageKey] = useState<string>('');
  const [audioMode, setAudioMode] = useState<'local_blob' | 'heritage_synth'>('heritage_synth');

  // Microphone live capture state
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const meterRafRef = useRef<number | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stopMicCleanup();
      return;
    }

    setErrorMsg(null);
    setPendingBlob(null);
    setPendingFileName('');

    if (editingRecord) {
      setAccessionCode(editingRecord.accessionCode);
      setTitle(editingRecord.title);
      setSpeaker(editingRecord.speaker);
      setYear(editingRecord.year);
      setLocation(editingRecord.location);
      setSourceFormat(editingRecord.sourceFormat);
      setPhysicalCondition(editingRecord.physicalCondition);
      setDescription(editingRecord.description);
      setUsageScope(editingRecord.usageScope);
      setUsageNotes(editingRecord.usageNotes);
      setDurationSeconds(editingRecord.durationSeconds);
      setWaveformPeaks(editingRecord.waveformPeaks);
      setMarkers(editingRecord.markers);
      setExistingStorageKey(editingRecord.audioStorageKey);
      setAudioMode(editingRecord.audioMode);
    } else {
      const randSuffix = String(Math.floor(10 + Math.random() * 89));
      setAccessionCode(`H01-${new Date().getFullYear()}-${randSuffix}`);
      setTitle('');
      setSpeaker('');
      setYear(1994);
      setLocation('');
      setSourceFormat('cassette');
      setPhysicalCondition('fair');
      setDescription('');
      setUsageScope('family');
      setUsageNotes('Lưu giữ làm tư liệu gia đình; ghi rõ nguồn khi trích dẫn.');
      setDurationSeconds(120);
      setWaveformPeaks(DEFAULT_PEAKS);
      setMarkers([]);
      setExistingStorageKey('');
      setAudioMode('heritage_synth');
    }
  }, [isOpen, editingRecord]);

  const stopMicCleanup = () => {
    if (recTimerRef.current !== null) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setMicLevel(0);
  };

  if (!isOpen) return null;

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg(null);
    try {
      const analysis = await extractAudioAnalysis(file, 48);
      setPendingBlob(file);
      setPendingFileName(file.name);
      setDurationSeconds(analysis.durationSeconds);
      setWaveformPeaks(analysis.waveformPeaks);
      setAudioMode('local_blob');
    } catch {
      setErrorMsg('Không thể giải mã tệp âm thanh này. Vui lòng chọn tệp WAV, MP3, M4A hoặc OGG hợp lệ.');
    }
  };

  const startMicCapture = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const meterCtx = new AudioCtx();
      const source = meterCtx.createMediaStreamSource(stream);
      const analyser = meterCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArr = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteTimeDomainData(dataArr);
        let peak = 0;
        for (let i = 0; i < dataArr.length; i++) {
          const val = Math.abs((dataArr[i] - 128) / 128);
          if (val > peak) peak = val;
        }
        setMicLevel(Math.min(1, peak * 1.8));
        meterRafRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      const recorder = new MediaRecorder(stream);
      recChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        void meterCtx.close();
        stopMicCleanup();
        try {
          const analysis = await extractAudioAnalysis(blob, 48);
          setPendingBlob(blob);
          setPendingFileName('Bản thu trực tiếp từ đầu phát');
          setDurationSeconds(analysis.durationSeconds);
          setWaveformPeaks(analysis.waveformPeaks);
          setAudioMode('local_blob');
        } catch {
          setPendingBlob(blob);
          setPendingFileName('Bản thu trực tiếp từ đầu phát');
          setDurationSeconds(Math.max(1, recSeconds));
          setAudioMode('local_blob');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = window.setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setErrorMsg('Không thể truy cập micro hoặc cổng Line-In. Hãy cấp quyền micro cho trình duyệt.');
    }
  };

  const stopMicCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const parseMmSsToSeconds = (val: string): number => {
    const parts = val.trim().split(':').map(Number);
    if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return Math.max(0, Math.min(durationSeconds, parts[0] * 60 + parts[1]));
    }
    const num = Number(val);
    return Number.isNaN(num) ? 0 : Math.max(0, Math.min(durationSeconds, Math.round(num)));
  };

  const handleAddMarker = () => {
    const label = newMarkerLabel.trim();
    if (!label) return;
    if (markers.length >= BLUEPRINT_CONSTRAINTS.MARKERS_MAX) {
      setErrorMsg(`Tối đa ${BLUEPRINT_CONSTRAINTS.MARKERS_MAX} mốc thời gian cho mỗi bản ghi.`);
      return;
    }
    const timeSec = parseMmSsToSeconds(newMarkerTime);
    setMarkers((prev) =>
      [...prev, { timeSec, label: label.slice(0, BLUEPRINT_CONSTRAINTS.MARKER_LABEL_MAX) }].sort(
        (a, b) => a.timeSec - b.timeSec
      )
    );
    setNewMarkerLabel('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      setErrorMsg('Vui lòng đăng nhập tài khoản Google trước khi lưu thẻ bản ghi vào hệ thống.');
      return;
    }

    const cleanCode = accessionCode.trim();
    const cleanTitle = title.trim();
    const cleanSpeaker = speaker.trim();
    const cleanLocation = location.trim();
    const cleanDesc = description.trim();
    const cleanNotes = usageNotes.trim().slice(0, BLUEPRINT_CONSTRAINTS.USAGE_NOTES_MAX);

    if (
      cleanCode.length < BLUEPRINT_CONSTRAINTS.ACCESSION_CODE_MIN ||
      cleanCode.length > BLUEPRINT_CONSTRAINTS.ACCESSION_CODE_MAX ||
      !BLUEPRINT_CONSTRAINTS.ACCESSION_CODE_PATTERN.test(cleanCode)
    ) {
      setErrorMsg('Mã lưu trữ chỉ gồm chữ cái không dấu, số và dấu gạch ngang (ví dụ: H01-1994-06).');
      return;
    }
    if (cleanTitle.length < BLUEPRINT_CONSTRAINTS.TITLE_MIN) {
      setErrorMsg('Vui lòng nhập tên bản ghi (ít nhất 2 ký tự).');
      return;
    }
    if (cleanSpeaker.length < BLUEPRINT_CONSTRAINTS.SPEAKER_MIN) {
      setErrorMsg('Vui lòng nhập tên người nói hoặc nhân vật chính trong bản ghi.');
      return;
    }
    if (
      !Number.isInteger(year) ||
      year < BLUEPRINT_CONSTRAINTS.YEAR_MIN ||
      year > BLUEPRINT_CONSTRAINTS.YEAR_MAX
    ) {
      setErrorMsg('Năm ghi âm phải nằm trong khoảng 1930 đến 2026.');
      return;
    }
    if (cleanLocation.length < BLUEPRINT_CONSTRAINTS.LOCATION_MIN) {
      setErrorMsg('Vui lòng nhập địa điểm hoặc bối cảnh gia đình/cộng đồng.');
      return;
    }
    if (cleanDesc.length < BLUEPRINT_CONSTRAINTS.DESCRIPTION_MIN) {
      setErrorMsg('Mô tả nội dung bản ghi cần tối thiểu 10 ký tự.');
      return;
    }

    setIsSubmitting(true);
    try {
      let storageKey = existingStorageKey;
      let finalAudioMode = audioMode;

      if (pendingBlob) {
        storageKey = `blob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await saveAudioBlob(storageKey, pendingBlob);
        finalAudioMode = 'local_blob';
      }

      await onSaveRecord({
        id: editingRecord?.id,
        accessionCode: cleanCode,
        title: cleanTitle.slice(0, BLUEPRINT_CONSTRAINTS.TITLE_MAX),
        speaker: cleanSpeaker.slice(0, BLUEPRINT_CONSTRAINTS.SPEAKER_MAX),
        year,
        location: cleanLocation.slice(0, BLUEPRINT_CONSTRAINTS.LOCATION_MAX),
        sourceFormat,
        physicalCondition,
        description: cleanDesc.slice(0, BLUEPRINT_CONSTRAINTS.DESCRIPTION_MAX),
        durationSeconds: Math.max(
          BLUEPRINT_CONSTRAINTS.DURATION_MIN,
          Math.min(BLUEPRINT_CONSTRAINTS.DURATION_MAX, Math.round(durationSeconds))
        ),
        usageScope,
        usageNotes: cleanNotes,
        audioMode: finalAudioMode,
        audioStorageKey: storageKey.slice(0, BLUEPRINT_CONSTRAINTS.AUDIO_STORAGE_KEY_MAX),
        synthPreset: 'custom_tape',
        waveformPeaks: waveformPeaks.slice(0, BLUEPRINT_CONSTRAINTS.WAVEFORM_MAX_POINTS),
        markers: markers.slice(0, BLUEPRINT_CONSTRAINTS.MARKERS_MAX),
      });
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể lưu thẻ bản ghi. Vui lòng thử lại.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Phòng số hoá và đăng ký thẻ bản ghi"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#FBF9F5] border border-[#E0D9CE] rounded-xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E0D9CE] mb-6">
          <div>
            <p className="text-xs font-mono text-[#8C3B1E] mb-1">
              Phòng số hoá & Biên mục H01
            </p>
            <h2 className="text-2xl font-serif font-semibold text-[#1C1917]">
              {editingRecord ? 'Cập nhật thẻ bản ghi' : 'Đăng ký thẻ bản ghi âm thanh mới'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-2 rounded-lg border border-[#E0D9CE] text-[#57534E] hover:text-[#1C1917] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auth Gate Notice */}
        {!user && (
          <div className="mb-6 p-4 rounded-xl bg-[#F2EFE9] border border-[#E0D9CE] flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#1C1917]">
                Đăng nhập để lưu trữ và quản lý phạm vi bản ghi
              </p>
              <p className="text-xs text-[#57534E] mt-0.5">
                Xác thực Google giúp bảo vệ các bản ghi riêng tư gia đình và gắn quyền sở hữu hợp lệ.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onSignIn()}
              className="px-4 py-2 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] rounded-lg hover:bg-[#332E2A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Đăng nhập bằng Google
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Audio Source Capture Tabs */}
          <div className="bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <span className="text-sm font-semibold text-[#1C1917]">
                1. Tệp âm thanh số hoá
              </span>
              <div className="flex items-center gap-1 p-1 bg-[#EBE6DF] rounded-lg">
                <button
                  type="button"
                  onClick={() => setCaptureTab('upload')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    captureTab === 'upload'
                      ? 'bg-[#FBF9F5] text-[#1C1917]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  Tải tệp âm thanh
                </button>
                <button
                  type="button"
                  onClick={() => setCaptureTab('mic')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    captureTab === 'mic'
                      ? 'bg-[#FBF9F5] text-[#1C1917]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  Thu từ đầu phát / Micro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureTab('metadata_only');
                    setAudioMode('heritage_synth');
                    setPendingBlob(null);
                    setPendingFileName('');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    captureTab === 'metadata_only'
                      ? 'bg-[#FBF9F5] text-[#1C1917]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  Chỉ tạo thẻ biên mục
                </button>
              </div>
            </div>

            {captureTab === 'upload' && (
              <div>
                <label className="flex flex-col items-center justify-center p-5 border border-dashed border-[#C7BEB0] rounded-lg bg-[#FBF9F5] hover:border-[#8C3B1E] transition-colors cursor-pointer">
                  <Upload className="w-5 h-5 text-[#8C3B1E] mb-2" />
                  <span className="text-sm font-medium text-[#1C1917]">
                    {pendingFileName || 'Chọn tệp WAV, MP3, M4A hoặc OGG từ máy tính'}
                  </span>
                  <span className="text-xs text-[#6B655E] mt-1">
                    Trình duyệt sẽ tự phân tích dạng sóng và thời lượng thực tế
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => void handleFileChange(e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {captureTab === 'mic' && (
              <div className="p-4 bg-[#FBF9F5] border border-[#E0D9CE] rounded-lg">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-medium text-[#1C1917]">
                      Thu âm trực tiếp qua Line-In / Micro
                    </p>
                    <p className="text-xs text-[#6B655E]">
                      Cắm đầu cassette vào ngõ vào âm thanh và bấm thu để số hoá trực tiếp.
                    </p>
                  </div>
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={() => void startMicCapture()}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#8C3B1E] text-[#FBF9F5] rounded-lg hover:bg-[#732E15] cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Bắt đầu thu âm</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopMicCapture}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] rounded-lg hover:bg-[#332E2A] cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Dừng thu ({formatDuration(recSeconds)})</span>
                    </button>
                  )}
                </div>

                {/* Live Input Level Meter */}
                <div className="h-2.5 w-full bg-[#EBE6DF] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#8C3B1E] transition-all duration-75"
                    style={{ width: `${Math.round(micLevel * 100)}%` }}
                  />
                </div>
                {pendingFileName && !isRecording && (
                  <p className="text-xs text-[#2C4A52] font-medium mt-2">
                    Đã lưu bản thu: {pendingFileName} ({formatDuration(durationSeconds)})
                  </p>
                )}
              </div>
            )}

            {captureTab === 'metadata_only' && (
              <p className="text-xs text-[#57534E] leading-relaxed">
                Tạo thẻ biên mục thông tin băng/đĩa trước, trình phát sẽ dùng luồng mô phỏng băng
                từ lưu trữ cho đến khi bạn tải tệp WAV/MP3 gốc lên.
              </p>
            )}
          </div>

          {/* Core Metadata Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#44403C] mb-1.5">
                Tên bản ghi *
              </label>
              <input
                type="text"
                required
                maxLength={BLUEPRINT_CONSTRAINTS.TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Lời kể của ông nội về ngày tiếp quản Thủ đô"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#8C3B1E]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#44403C] mb-1.5">
                Người nói / Nhân vật chính *
              </label>
              <input
                type="text"
                required
                maxLength={BLUEPRINT_CONSTRAINTS.SPEAKER_MAX}
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                placeholder="Ví dụ: Ông Trần Văn Minh (78 tuổi)"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#8C3B1E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#44403C] mb-1.5">
                  Năm ghi âm *
                </label>
                <input
                  type="number"
                  required
                  min={BLUEPRINT_CONSTRAINTS.YEAR_MIN}
                  max={BLUEPRINT_CONSTRAINTS.YEAR_MAX}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#8C3B1E]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#44403C] mb-1.5">
                  Mã lưu trữ *
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.ACCESSION_CODE_MAX}
                  value={accessionCode}
                  onChange={(e) => setAccessionCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#8C3B1E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#44403C] mb-1.5">
                Địa điểm / Bối cảnh ghi âm *
              </label>
              <input
                type="text"
                required
                maxLength={BLUEPRINT_CONSTRAINTS.LOCATION_MAX}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ví dụ: Thôn Đông Ngạc, Bắc Từ Liêm, Hà Nội"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#8C3B1E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#44403C] mb-1.5">
                  Vật mang tin gốc
                </label>
                <select
                  value={sourceFormat}
                  onChange={(e) => setSourceFormat(e.target.value as SourceFormat)}
                  className="w-full px-3 py-2.5 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#8C3B1E]"
                >
                  <option value="cassette">Băng Cassette</option>
                  <option value="vinyl_cd">Đĩa Than / CD Cũ</option>
                  <option value="reel_to_reel">Băng Cối</option>
                  <option value="other">Tư liệu khác</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#44403C] mb-1.5">
                  Tình trạng vật lý
                </label>
                <select
                  value={physicalCondition}
                  onChange={(e) => setPhysicalCondition(e.target.value as PhysicalCondition)}
                  className="w-full px-3 py-2.5 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#8C3B1E]"
                >
                  <option value="good">Tốt</option>
                  <option value="fair">Rè nhẹ / Mốc nhẹ</option>
                  <option value="fragile">Xuống cấp nặng</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#44403C] mb-1.5">
                Mô tả nội dung từng bản ghi *
              </label>
              <textarea
                required
                rows={3}
                maxLength={BLUEPRINT_CONSTRAINTS.DESCRIPTION_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tóm tắt nội dung câu chuyện, bài hát, sự kiện, chất lượng âm thanh mặt A/B..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#8C3B1E]"
              />
            </div>
          </div>

          {/* Timestamped Content Markers */}
          <div className="border-t border-[#E0D9CE] pt-5">
            <label className="block text-xs font-semibold text-[#1C1917] mb-2">
              Mốc nội dung theo thời gian (tuỳ chọn)
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="text"
                value={newMarkerTime}
                onChange={(e) => setNewMarkerTime(e.target.value)}
                placeholder="00:45"
                className="w-24 px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917]"
              />
              <input
                type="text"
                value={newMarkerLabel}
                onChange={(e) => setNewMarkerLabel(e.target.value)}
                placeholder="Nội dung đoạn này (vd: Bà kể chuyện mùa nước nổi)"
                className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917]"
              />
              <button
                type="button"
                onClick={handleAddMarker}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-[#EBE6DF] text-[#1C1917] rounded-lg hover:bg-[#E0D9CE] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm mốc</span>
              </button>
            </div>
            {markers.length > 0 && (
              <ul className="space-y-1.5">
                {markers.map((m, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#F2EFE9] rounded-md text-xs"
                  >
                    <span className="text-[#292524]">
                      <span className="font-mono text-[#8C3B1E] mr-2 tabular-nums">
                        {formatDuration(m.timeSec)}
                      </span>
                      {m.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMarkers((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-[#6B655E] hover:text-[#991B1B] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Usage Scope Governance */}
          <div className="border-t border-[#E0D9CE] pt-5">
            <label className="block text-xs font-semibold text-[#1C1917] mb-3">
              Phạm vi được phép dùng *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {(['private', 'family', 'community', 'public'] as UsageScope[]).map((scope) => {
                const meta = USAGE_SCOPE_META[scope];
                const selected = usageScope === scope;
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setUsageScope(scope)}
                    className={`p-3.5 text-left rounded-lg border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#EBE6DF] border-[#8C3B1E]'
                        : 'bg-[#FBF9F5] border-[#E0D9CE] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-[#1C1917] mb-0.5">
                      {meta.label}
                    </span>
                    <span className="block text-xs text-[#57534E] leading-relaxed">
                      {meta.summary}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="block text-xs font-medium text-[#44403C] mb-1.5">
              Điều kiện trích dẫn & Ghi chú bản quyền gia đình
            </label>
            <input
              type="text"
              maxLength={BLUEPRINT_CONSTRAINTS.USAGE_NOTES_MAX}
              value={usageNotes}
              onChange={(e) => setUsageNotes(e.target.value)}
              placeholder="Ví dụ: Không dùng cho mục đích thương mại; cần ghi công gia đình..."
              className="w-full px-3.5 py-2 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917]"
            />
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              {errorMsg}
            </div>
          )}

          <div className="pt-4 border-t border-[#E0D9CE] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#57534E] hover:text-[#1C1917] cursor-pointer"
            >
              Huỷ bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !user}
              className="px-5 py-2.5 text-sm font-medium bg-[#8C3B1E] text-[#FBF9F5] rounded-lg hover:bg-[#732E15] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isSubmitting
                ? 'Đang lưu...'
                : editingRecord
                  ? 'Lưu cập nhật'
                  : 'Lưu thẻ bản ghi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

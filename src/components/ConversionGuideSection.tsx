import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, Disc3, HardDrive, Sliders, Wrench } from 'lucide-react';
import { CONVERSION_STEPS, HARDWARE_PROFILES } from '../data/curatedArchive';

const CHECKLIST_STORAGE_KEY = 'h01_predigitize_checklist_v1';

const PRE_CHECKLIST_ITEMS = [
  'Đã kiểm tra băng không bị mốc trắng, xoắn mép hoặc đứt mối nối đầu dẫn',
  'Đã vệ sinh đầu từ, trục cuốn bằng tăm bông thấm cồn Isopropyl',
  'Đã kết nối đúng cổng Line-Out (không dùng Mic-In gây méo tiếng)',
  'Đã chỉnh mức đỉnh tín hiệu (Gain) nằm trong khoảng -12 dB đến -6 dB',
  'Đã chuẩn bị thông tin người nói, năm ghi âm và phạm vi được phép dùng',
];

export const ConversionGuideSection: React.FC = () => {
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [selectedHardwareId, setSelectedHardwareId] = useState<'cassette' | 'cd_vcd' | 'turntable'>(
    'cassette'
  );
  const [minutesInput, setMinutesInput] = useState<number>(60);
  const [checkedItems, setCheckedItems] = useState<boolean[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === PRE_CHECKLIST_ITEMS.length) {
          return parsed.map(Boolean);
        }
      }
    } catch {
      // ignore localStorage failure
    }
    return new Array(PRE_CHECKLIST_ITEMS.length).fill(false);
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checkedItems));
    } catch {
      // ignore localStorage failure
    }
  }, [checkedItems]);

  const activeStep = CONVERSION_STEPS[activeStepIdx];
  const hardware =
    HARDWARE_PROFILES.find((h) => h.id === selectedHardwareId) || HARDWARE_PROFILES[0];

  // Storage math:
  // WAV 48kHz / 24-bit Stereo = 48000 * 3 * 2 = 288,000 bytes/sec => ~16.48 MB/min
  // MP3 320kbps = 320,000 bits/sec = 40,000 bytes/sec => ~2.29 MB/min
  const safeMinutes = Math.max(1, Math.min(600, Number.isFinite(minutesInput) ? minutesInput : 60));
  const wavMb = (safeMinutes * 60 * 288000) / (1024 * 1024);
  const mp3Mb = (safeMinutes * 60 * 40000) / (1024 * 1024);
  const completedCount = checkedItems.filter(Boolean).length;

  return (
    <section
      id="huong-dan-chuyen-doi"
      className="py-16 md:py-20 border-t border-[#E0D9CE]"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-mono tracking-widest uppercase text-[#6B655E] mb-3">
            Quy trình thực hành chuẩn bảo tồn
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-[#1C1917] leading-tight [text-wrap:balance] mb-4">
            Hướng dẫn chuyển đổi băng cassette & đĩa cũ sang tệp số
          </h2>
          <p className="text-base text-[#57534E] leading-relaxed">
            Quy trình 5 bước giúp các gia đình và nhóm lưu trữ cộng đồng tự thực hiện số hoá an toàn,
            giữ nguyên vẹn tư liệu gốc trước khi băng từ bị thoái hoá.
          </p>
        </div>

        {/* 5-Step Interactive Guide */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          {/* Left Rail: Step Selector */}
          <div className="lg:col-span-4 flex flex-col border-t border-[#E0D9CE]">
            {CONVERSION_STEPS.map((step, index) => {
              const isActive = index === activeStepIdx;
              return (
                <button
                  key={step.stepNumber}
                  type="button"
                  onClick={() => setActiveStepIdx(index)}
                  className={`text-left py-4 px-4 border-b border-[#E0D9CE] flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EBE6DF] text-[#1C1917]'
                      : 'bg-transparent text-[#57534E] hover:bg-[#F2EFE9]'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block text-xs font-mono text-[#8C3B1E] mb-1">
                      Bước {step.stepNumber}
                    </span>
                    <span className="block text-sm font-semibold leading-snug">
                      {step.title}
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isActive ? 'text-[#8C3B1E] translate-x-0.5' : 'text-[#8C857B]'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right Panel: Active Step Details */}
          <div className="lg:col-span-8 bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl p-6 md:p-8">
            <div className="flex items-center gap-3 text-xs font-mono text-[#8C3B1E] mb-2">
              <span>Bước {activeStep.stepNumber} / 05</span>
              <span aria-hidden="true">·</span>
              <span>Tiêu chuẩn H01</span>
            </div>
            <h3 className="text-2xl font-serif font-semibold text-[#1C1917] mb-3 [text-wrap:balance]">
              {activeStep.title}
            </h3>
            <p className="text-base text-[#44403C] leading-relaxed mb-6">{activeStep.summary}</p>

            {activeStep.imagePath && (
              <figure className="mb-6">
                <div className="overflow-hidden rounded-lg border border-[#E0D9CE] bg-[#EBE6DF] aspect-[4/3] max-h-[340px] w-full">
                  <img
                    src={activeStep.imagePath}
                    alt={activeStep.imageCaption || activeStep.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                {activeStep.imageCaption && (
                  <figcaption className="text-xs font-serif italic text-[#6B655E] mt-2">
                    {activeStep.imageCaption}
                  </figcaption>
                )}
              </figure>
            )}

            <ol className="space-y-3 mb-6">
              {activeStep.details.map((line, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-[#292524] leading-relaxed"
                >
                  <span className="font-mono text-xs text-[#8C3B1E] pt-0.5 shrink-0 tabular-nums">
                    0{i + 1}.
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>

            <div className="p-4 rounded-lg bg-[#FBF9F5] border border-[#E0D9CE]">
              <p className="text-xs font-semibold text-[#8C3B1E] mb-1">Lưu ý bảo toàn tư liệu</p>
              <p className="text-sm text-[#44403C] leading-relaxed">{activeStep.caution}</p>
            </div>
          </div>
        </div>

        {/* Interactive Tools Row: Hardware Wiring + Storage Calculator + Pre-Check */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Hardware Wiring Switcher (7 cols) */}
          <div className="lg:col-span-7 bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <Wrench className="w-4 h-4 text-[#8C3B1E]" />
                  <h3 className="text-lg font-serif font-semibold text-[#1C1917]">
                    Sơ đồ đấu nối theo thiết bị nguồn
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EBE6DF] rounded-lg">
                  {HARDWARE_PROFILES.map((profile) => {
                    const active = profile.id === selectedHardwareId;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => setSelectedHardwareId(profile.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[#FBF9F5] text-[#1C1917]'
                            : 'text-[#57534E] hover:text-[#1C1917]'
                        }`}
                      >
                        {profile.id === 'cassette'
                          ? 'Cassette'
                          : profile.id === 'cd_vcd'
                            ? 'Đĩa CD/VCD'
                            : 'Đĩa than'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <dl className="divide-y divide-[#E0D9CE] border-t border-b border-[#E0D9CE]">
                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <dt className="text-xs font-medium text-[#6B655E]">1. Nguồn phát gốc</dt>
                  <dd className="sm:col-span-2 text-sm text-[#1C1917]">{hardware.sourceDevice}</dd>
                </div>
                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <dt className="text-xs font-medium text-[#6B655E]">2. Dây tín hiệu</dt>
                  <dd className="sm:col-span-2 text-sm text-[#1C1917]">{hardware.cableType}</dd>
                </div>
                <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <dt className="text-xs font-medium text-[#6B655E]">3. Tầng chuyển đổi</dt>
                  <dd className="sm:col-span-2 text-sm text-[#1C1917]">{hardware.converterStage}</dd>
                </div>
              </dl>
            </div>

            <p className="text-xs text-[#57534E] mt-4 leading-relaxed">
              <strong className="text-[#1C1917] font-semibold">Khuyến nghị kỹ thuật: </strong>
              {hardware.captureNote}
            </p>
          </div>

          {/* Storage Calculator & Pre-Digitize Checklist (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Storage Calculator */}
            <div className="bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#8C3B1E]" />
                  <h3 className="text-base font-serif font-semibold text-[#1C1917]">
                    Ước tính dung lượng tệp số
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#6B655E] tabular-nums">
                  {safeMinutes} phút
                </span>
              </div>

              <label htmlFor="tape-duration-input" className="block text-xs text-[#57534E] mb-2">
                Tổng thời lượng băng/đĩa cần số hoá (phút):
              </label>
              <div className="flex items-center gap-3 mb-4">
                <input
                  id="tape-duration-input"
                  type="range"
                  min={5}
                  max={240}
                  step={5}
                  value={safeMinutes}
                  onChange={(e) => setMinutesInput(Number(e.target.value))}
                  className="w-full accent-[#8C3B1E] cursor-pointer"
                />
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={safeMinutes}
                  onChange={(e) => setMinutesInput(Number(e.target.value))}
                  aria-label="Số phút băng ghi âm"
                  className="w-20 px-2.5 py-1.5 text-sm font-mono tabular-nums bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E0D9CE]">
                <div>
                  <span className="block text-xs text-[#6B655E]">Bản Master WAV 24-bit/48kHz</span>
                  <span className="text-lg font-mono font-medium text-[#1C1917] tabular-nums">
                    {wavMb >= 1024 ? `${(wavMb / 1024).toFixed(2)} GB` : `${wavMb.toFixed(0)} MB`}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-[#6B655E]">Bản Nghe Web MP3 320kbps</span>
                  <span className="text-lg font-mono font-medium text-[#1C1917] tabular-nums">
                    {mp3Mb.toFixed(1)} MB
                  </span>
                </div>
              </div>
            </div>

            {/* Pre-Digitize Checklist */}
            <div className="bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#8C3B1E]" />
                  <h3 className="text-base font-serif font-semibold text-[#1C1917]">
                    Bảng kiểm trước khi bấm thu
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#6B655E] tabular-nums">
                  {completedCount}/{PRE_CHECKLIST_ITEMS.length}
                </span>
              </div>
              <ul className="space-y-2.5">
                {PRE_CHECKLIST_ITEMS.map((item, idx) => {
                  const checked = checkedItems[idx];
                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() =>
                          setCheckedItems((prev) => prev.map((v, i) => (i === idx ? !v : v)))
                        }
                        className="w-full text-left flex items-start gap-2.5 text-xs text-[#292524] leading-relaxed cursor-pointer group"
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            checked
                              ? 'bg-[#8C3B1E] border-[#8C3B1E] text-[#FBF9F5]'
                              : 'bg-[#FBF9F5] border-[#C7BEB0] group-hover:border-[#8C3B1E]'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                        <span className={checked ? 'line-through text-[#78716C]' : ''}>
                          {item}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 pt-3 border-t border-[#E0D9CE] flex items-center justify-between text-xs text-[#6B655E]">
                <span className="inline-flex items-center gap-1.5">
                  <Disc3 className="w-3.5 h-3.5" />
                  Trạng thái tự động lưu cục bộ
                </span>
                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCheckedItems(new Array(PRE_CHECKLIST_ITEMS.length).fill(false))
                    }
                    className="text-[#8C3B1E] hover:underline cursor-pointer"
                  >
                    Đặt lại
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

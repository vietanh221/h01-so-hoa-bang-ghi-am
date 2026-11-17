import React from 'react';

interface TopBarProps {
  onOpenRegisterModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenRegisterModal }) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-sm border-b border-[#E0D9CE]">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Wordmark */}
        <a
          href="#top"
          className="text-xl font-serif font-semibold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8C3B1E]"
        >
          Ký Ức Băng Từ
        </a>

        {/* Zone 2: 4 single-line editorial nav links */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E]"
        >
          <a
            href="#kho-ban-ghi"
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Kho Bản Ghi
          </a>
          <a
            href="#huong-dan-chuyen-doi"
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Hướng Dẫn Số Hoá
          </a>
          <a
            href="#pham-vi-su-dung"
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Phạm Vi Dùng
          </a>
          <a
            href="#gioi-thieu-de-tai"
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Đề Tài H01
          </a>
        </nav>

        {/* Zone 3: 1 primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenRegisterModal}
            className="px-4 py-2 text-sm font-medium text-[#FBF9F5] bg-[#8C3B1E] rounded-lg hover:bg-[#732E15] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C3B1E]"
          >
            Đăng Ký Bản Ghi
          </button>
        </div>
      </div>
    </header>
  );
};

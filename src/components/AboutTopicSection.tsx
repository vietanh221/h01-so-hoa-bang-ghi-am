import React from 'react';

export const AboutTopicSection: React.FC = () => {
  return (
    <section id="gioi-thieu-de-tai" className="py-16 md:py-20 border-t border-[#E0D9CE]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6">
            <figure className="h-full flex flex-col">
              <div className="overflow-hidden rounded-xl border border-[#E0D9CE] bg-[#EBE6DF] flex-1 min-h-[280px]">
                <img
                  src="/src/assets/images/archive_family_reel_1794926083696.jpg"
                  alt="Băng cassette, đĩa CD cũ và sổ tay ký ức gia đình trên bàn gỗ"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <figcaption className="text-xs font-serif italic text-[#6B655E] mt-2.5">
                Hình 3 — Băng cassette, đĩa CD-R thập niên 1990 và sổ ghi chép ký ức gia đình trước
                khi tiến hành biên mục số.
              </figcaption>
            </figure>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-mono tracking-widest uppercase text-[#8C3B1E] mb-3">
              Hồ sơ đề tài nghiên cứu & Thực hành
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-[#1C1917] leading-tight [text-wrap:balance] mb-4">
              Gìn giữ giọng nói của những thế hệ đi trước
            </h2>
            <p className="text-base text-[#44403C] leading-relaxed mb-6">
              Băng từ cassette và đĩa CD dân dụng có tuổi thọ vật lý giới hạn từ 15 đến 30 năm
              trong khí hậu nhiệt đới ẩm. Đề tài H01 xây dựng quy trình và công cụ thực hành giúp
              từng gia đình, nhà văn hoá thôn xã tự chuyển đổi băng cũ sang tệp số, gắn ngữ cảnh
              người nói — năm ghi âm và bảo vệ đúng phạm vi được phép sử dụng.
            </p>

            <dl className="border-t border-b border-[#E0D9CE] divide-y divide-[#E0D9CE]">
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Mã đề tài</dt>
                <dd className="col-span-2 text-sm font-medium text-[#1C1917]">
                  H01 — Số hoá băng ghi âm trong gia đình và cộng đồng
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Lĩnh vực</dt>
                <dd className="col-span-2 text-sm text-[#1C1917]">Di sản tư liệu nghe nhìn</dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Sinh viên thực hiện</dt>
                <dd className="col-span-2 text-sm text-[#1C1917]">
                  Phạm Việt Anh <span className="font-mono text-xs text-[#6B655E]">(MSSV: PH59336)</span>
                </dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-xs text-[#6B655E]">Phạm vi kỹ thuật</dt>
                <dd className="col-span-2 text-sm text-[#1C1917]">
                  Hướng dẫn chuyển đổi, thẻ biên mục chuẩn, nghe trực tuyến Web Audio & phân cấp
                  quyền dùng
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
};

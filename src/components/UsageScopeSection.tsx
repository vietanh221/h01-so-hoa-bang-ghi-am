import React from 'react';
import { Globe, Home, Lock, Users } from 'lucide-react';
import { USAGE_SCOPE_META, type UsageScope } from '../types/archive';

interface UsageScopeSectionProps {
  countsByScope: Record<UsageScope, number>;
  activeScopeFilter: 'all' | UsageScope;
  onSelectScope: (scope: UsageScope) => void;
}

const SCOPE_ORDER: UsageScope[] = ['private', 'family', 'community', 'public'];

function renderScopeIcon(scope: UsageScope) {
  switch (scope) {
    case 'private':
      return <Lock className="w-4 h-4 text-[#8C3B1E]" />;
    case 'family':
      return <Home className="w-4 h-4 text-[#8C3B1E]" />;
    case 'community':
      return <Users className="w-4 h-4 text-[#2C4A52]" />;
    case 'public':
      return <Globe className="w-4 h-4 text-[#2C4A52]" />;
  }
}

export const UsageScopeSection: React.FC<UsageScopeSectionProps> = ({
  countsByScope,
  activeScopeFilter,
  onSelectScope,
}) => {
  return (
    <section
      id="pham-vi-su-dung"
      className="py-16 md:py-20 border-t border-[#E0D9CE] bg-[#F2EFE9]/55"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-mono tracking-widest uppercase text-[#6B655E] mb-3">
            Quy chuẩn đạo đức & Quyền tiếp cận tư liệu
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-[#1C1917] leading-tight [text-wrap:balance] mb-4">
            Phạm vi được phép dùng của từng bản ghi
          </h2>
          <p className="text-base text-[#57534E] leading-relaxed">
            Băng ghi âm gia đình thường chứa ký ức thân mật và giọng nói của nhiều thế hệ. Mọi thẻ
            bản ghi đều phải xác lập rõ phạm vi lưu hành trước khi đưa lên không gian trực tuyến.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SCOPE_ORDER.map((scope, index) => {
            const meta = USAGE_SCOPE_META[scope];
            const isSelected = activeScopeFilter === scope;
            return (
              <div
                key={scope}
                className={`p-6 rounded-xl border transition-colors flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#EBE6DF] border-[#8C3B1E]'
                    : 'bg-[#FBF9F5] border-[#E0D9CE]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="text-xs font-mono text-[#6B655E] tabular-nums">
                      Cấp 0{index + 1}
                    </span>
                    {renderScopeIcon(scope)}
                  </div>
                  <h3 className="text-lg font-serif font-semibold text-[#1C1917] mb-2">
                    {meta.label}
                  </h3>
                  <p className="text-sm text-[#44403C] leading-relaxed mb-3">{meta.summary}</p>
                  <p className="text-xs text-[#6B655E] leading-relaxed pt-3 border-t border-[#E0D9CE]">
                    {meta.rightsRule}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-[#E0D9CE] flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-[#57534E] tabular-nums">
                    {countsByScope[scope]} bản ghi
                  </span>
                  <a
                    href="#kho-ban-ghi"
                    onClick={() => onSelectScope(scope)}
                    className="text-xs font-semibold text-[#8C3B1E] hover:underline whitespace-nowrap shrink-0"
                  >
                    Lọc xem nhóm này
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

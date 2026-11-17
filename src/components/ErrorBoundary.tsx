import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Đã xảy ra lỗi không mong muốn trong ứng dụng.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed.error && parsed.operationType) {
          friendlyMsg = `Lỗi truy cập dữ liệu (${parsed.operationType} tại ${parsed.path || 'Firestore'}): ${parsed.error}`;
        }
      } catch {
        // Non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#FBF9F5] text-[#1C1917] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#F2EFE9] border border-[#E0D9CE] rounded-xl p-8">
            <p className="text-xs font-mono uppercase tracking-widest text-[#8C3B1E] mb-2">
              Thông báo hệ thống lưu trữ
            </p>
            <h1 className="text-2xl font-serif font-semibold text-[#1C1917] mb-3">
              Không thể hoàn tất thao tác dữ liệu
            </h1>
            <p className="text-sm text-[#57534E] leading-relaxed mb-6">{friendlyMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] rounded-lg hover:bg-[#332E2A] transition-colors cursor-pointer"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

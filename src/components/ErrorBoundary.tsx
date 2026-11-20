import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Something unexpected went wrong.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('YAO Hub ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `Database access issue (${parsed.operationType || 'read'} on ${parsed.path || 'hub'}): ${parsed.error}`;
        }
      } catch {
        // Keep original message
      }

      return (
        <div className="min-h-screen bg-[#F4EEF7] dark:bg-[#140D1A] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 text-[#3B1050] dark:text-[#D98EB3]">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold">Something went wrong</h2>
            </div>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9] leading-relaxed break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Hub
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

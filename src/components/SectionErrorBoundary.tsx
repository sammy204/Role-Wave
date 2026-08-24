import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/react';

type SectionErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  description?: string;
};

type SectionErrorBoundaryState = {
  hasError: boolean;
};

export default class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Section failed to render:', error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  retry = () => {
    this.setState({ hasError: false });
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="panel flex min-h-[360px] flex-col items-center justify-center rounded-[28px] px-6 py-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDECEA] text-[#B3261E]">
          <AlertTriangle size={22} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-[#1A1A1A]">{this.props.title || 'This section could not load'}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[#5F5E5A]">
          {this.props.description || 'Something went wrong in this section. You can try again without leaving the rest of RoleWave.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={this.retry} className="inline-flex items-center gap-2 rounded-full bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#168a63]">
            <RefreshCw size={14} /> Try again
          </button>
          <button type="button" onClick={this.reload} className="rounded-full border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#5F5E5A] hover:border-[#5DCAA5]">
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error('OPTIMIS Root Error Boundary caught:', error);
  }

  handleRecover = () => {
    try {
      localStorage.removeItem('e_oppkpke_blora_session_v2');
      localStorage.removeItem('e_oppkpke_blora_periode_v3');
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#F3F6FD] flex items-center justify-center p-6 text-slate-900">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-7 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] font-extrabold text-lg flex items-center justify-center mx-auto">
              !
            </div>
            <h1 className="text-lg font-extrabold text-slate-900">
              OPTIMIS (Optimalisasi Pengentasan Kemiskinan)
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Terjadi pembaruan sesi pada peramban Anda. Silakan klik tombol di bawah untuk memuat ulang aplikasi.
            </p>
            <button
              type="button"
              onClick={this.handleRecover}
              className="w-full py-3 px-5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Otomatis muat ulang sekali apabila peramban mencoba memuat chunk lama pasca-deploy baru di Vercel
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

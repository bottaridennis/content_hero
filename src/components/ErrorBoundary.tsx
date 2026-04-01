import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Si è verificato un errore imprevisto.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Errore di database (${parsed.operationType} su ${parsed.path}): ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
          <div className="rounded-3xl bg-white p-8 shadow-xl max-w-md">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-rose-500" />
            <h1 className="mb-2 text-2xl font-bold text-slate-900">Ops! Qualcosa è andato storto</h1>
            <p className="mb-6 text-slate-600">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Ricarica l'app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

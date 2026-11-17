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
        <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas p-4 text-center">
          <div className="card max-w-md p-8 shadow-pop">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-danger" />
            <h1 className="mb-2 text-2xl font-bold text-fg">Ops! Qualcosa è andato storto</h1>
            <p className="mb-6 text-muted">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
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

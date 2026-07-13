import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('GrowLens render failure', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="main-content" role="alert" style={{ margin: '0 auto', maxWidth: 760, paddingTop: '10vh' }}>
        <section className="section-block">
          <span className="brand-mark">GL</span>
          <h1>GrowLens hit an unexpected error.</h1>
          <p>Your locally saved grow records were not intentionally deleted. Reload the app first; use your latest exported backup if browser storage was damaged.</p>
          <details style={{ marginBottom: 20 }}>
            <summary>Technical detail</summary>
            <code>{this.state.message}</code>
          </details>
          <button className="primary-button" onClick={this.reload}>Reload GrowLens</button>
        </section>
      </main>
    );
  }
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

class PortalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    console.error("Portal render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell flex min-h-screen items-center justify-center px-4">
          <div className="panel max-w-2xl p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-600">
              Portal error
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Giao diện đang gặp lỗi</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Mình đã bọc portal bằng error boundary để không còn trắng trang. Lỗi chi tiết:
            </p>
            <pre className="mt-4 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-rose-700">
              {String(this.state.error?.message || this.state.error || "Unknown error")}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PortalErrorBoundary>
      <App />
    </PortalErrorBoundary>
  </React.StrictMode>,
);

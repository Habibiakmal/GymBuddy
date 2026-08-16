import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("GymBuddy Global Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0A0D14", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "Inter, sans-serif", textAlign: "center" }}>
          <div style={{ background: "#121722", border: "1px solid rgba(212, 255, 0, 0.3)", borderRadius: "24px", padding: "32px", maxWidth: "480px", width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚡</div>
            <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#fff", marginBottom: "8px" }}>Memuat GymBuddy AI...</h1>
            <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "24px" }}>
              Sesi kamu sedang disegarkan. Klik tombol di bawah untuk langsung membuka Dashboard.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem("gymbuddy_active_session");
                window.location.href = "/";
              }}
              style={{ backgroundColor: "#D4FF00", color: "#000", border: "none", borderRadius: "14px", padding: "12px 24px", fontSize: "14px", fontWeight: "800", cursor: "pointer", width: "100%" }}
            >
              Buka Dashboard Sekarang 🚀
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

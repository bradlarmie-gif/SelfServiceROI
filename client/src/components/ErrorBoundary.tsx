import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Application error:", error, errorInfo);
  }

  handleReload = () => {
    sessionStorage.clear();
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-xl font-semibold text-[#111827] mb-2">
              Something went wrong
            </h1>
            <p className="text-[#6B7280] mb-6">
              We encountered an unexpected error. Your data has been preserved where possible.
            </p>
            <Button
              onClick={this.handleReload}
              className="bg-[#EA2C00] hover:bg-[#d12700] text-white"
              data-testid="button-reload-app"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Restart Calculator
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

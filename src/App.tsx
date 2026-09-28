import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { AuthProvider } from "./contexts/AuthProvider";
import { ToastProvider } from "./contexts/ToastProvider";
import { ThemeProvider } from "./contexts/ThemeProvider";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary scope="app">
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

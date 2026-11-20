import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css"; // component library styles first, so app styles can override
import App from "./App.jsx";
import Landing from "./pages/Landing.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import { AuthProvider, GuestOnly, RequireAuth } from "./lib/auth.jsx";
import "./styles.css";
import "./pages.css";

// Corporate blue scale (shade 6 = #1d4ed8, matches --primary in styles.css)
const brand = ["#eef4ff", "#dbe6fe", "#bfd3fe", "#93b4fd", "#6090fa", "#3b6ef6", "#1d4ed8", "#1a43c0", "#173aa6", "#14318c"];

const theme = createTheme({
  colors: { brand },
  primaryColor: "brand",
  primaryShade: 6,
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  headings: { fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: "650" },
  defaultRadius: "md",
});

// Old links used #finder-style hashes; send them to the new routes.
const legacyHash = window.location.hash.slice(1);
if (window.location.pathname === "/" && /^(analyze|finder|coach|tracker|gaps)$/.test(legacyHash)) {
  window.history.replaceState(null, "", `/app/${legacyHash}`);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
            <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
            <Route path="/signup" element={<GuestOnly><AuthPage mode="signup" /></GuestOnly>} />
            <Route path="/app" element={<Navigate to="/app/analyze" replace />} />
            <Route path="/app/:page" element={<RequireAuth><App /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>
);

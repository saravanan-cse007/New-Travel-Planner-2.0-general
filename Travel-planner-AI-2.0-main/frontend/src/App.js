import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Planner from "@/pages/Planner";
import Itinerary from "@/pages/Itinerary";
import Profile from "@/pages/Profile";
import SharedTrip from "@/pages/SharedTrip";
import Navbar from "@/components/Navbar";
import "@/index.css";

function Protected({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
      <div className="min-h-screen text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/planner" element={<Protected><Planner /></Protected>} />
          <Route path="/trips/:id" element={<Protected><Itinerary /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/share/:shareId" element={<SharedTrip />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Toaster theme="dark" position="top-right" richColors />
      </div>
    </BrowserRouter>
    </HelmetProvider>
  );
}

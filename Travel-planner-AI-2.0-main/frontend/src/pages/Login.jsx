import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plane } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAuth(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}`);
      nav("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main data-testid="login-page" className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg btn-primary flex items-center justify-center"><Plane className="w-4 h-4" /></div>
          <span className="font-display text-lg font-semibold">Travel Planner AI</span>
        </Link>
        <h1 className="font-display text-3xl mb-1">Welcome back</h1>
        <p className="text-white/60 text-sm mb-6">Sign in to access your itineraries</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-white/80">Email</Label>
            <Input data-testid="login-email" id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white mt-1.5 h-11" />
          </div>
          <div>
            <Label htmlFor="password" className="text-white/80">Password</Label>
            <Input data-testid="login-password" id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border-white/10 text-white mt-1.5 h-11" />
          </div>
          <Button data-testid="login-submit" type="submit" disabled={loading}
            className="btn-primary text-white border-0 w-full h-11 rounded-full font-semibold">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="text-sm text-white/50 mt-6 text-center">
          Don&apos;t have an account?{" "}
          <Link to="/signup" data-testid="login-to-signup" className="text-fuchsia-300 hover:underline">Sign up</Link>
        </p>
      </div>
    </main>
  );
}

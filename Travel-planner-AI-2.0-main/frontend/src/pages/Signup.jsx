import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plane } from "lucide-react";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", form);
      setAuth(data.token, data.user);
      toast.success(`Welcome, ${data.user.name}!`);
      nav("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <main data-testid="signup-page" className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg btn-primary flex items-center justify-center"><Plane className="w-4 h-4" /></div>
          <span className="font-display text-lg font-semibold">Travel Planner AI</span>
        </Link>
        <h1 className="font-display text-3xl mb-1">Create your account</h1>
        <p className="text-white/60 text-sm mb-6">Start planning unforgettable trips in seconds</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="text-white/80">Name</Label>
            <Input data-testid="signup-name" required value={form.name} onChange={f("name")}
              className="bg-white/5 border-white/10 text-white mt-1.5 h-11" />
          </div>
          <div>
            <Label className="text-white/80">Email</Label>
            <Input data-testid="signup-email" type="email" required value={form.email} onChange={f("email")}
              className="bg-white/5 border-white/10 text-white mt-1.5 h-11" />
          </div>
          <div>
            <Label className="text-white/80">Password</Label>
            <Input data-testid="signup-password" type="password" required value={form.password} onChange={f("password")}
              className="bg-white/5 border-white/10 text-white mt-1.5 h-11" />
          </div>
          <Button data-testid="signup-submit" type="submit" disabled={loading}
            className="btn-primary text-white border-0 w-full h-11 rounded-full font-semibold">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="text-sm text-white/50 mt-6 text-center">
          Already have an account?{" "}
          <Link to="/login" data-testid="signup-to-login" className="text-fuchsia-300 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

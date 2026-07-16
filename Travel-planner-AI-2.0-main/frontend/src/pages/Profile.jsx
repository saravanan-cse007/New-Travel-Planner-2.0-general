import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({
    name: user?.name || "",
    preferred_currency: user?.preferred_currency || "INR",
    preferred_language: user?.preferred_language || "en",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/auth/me", form);
      setUser(data);
      toast.success("Profile updated");
    } catch { toast.error("Update failed"); }
    finally { setSaving(false); }
  };

  return (
    <main data-testid="profile-page" className="max-w-2xl mx-auto px-5 md:px-8 py-10">
      <div className="mb-6">
        <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300 mb-2">Account</div>
        <h1 className="font-display text-4xl">Profile</h1>
        <p className="text-white/60 mt-2">{user?.email}</p>
      </div>

      <form onSubmit={submit} className="glass rounded-3xl p-6 md:p-8 space-y-5">
        <div>
          <Label className="text-white/80 text-xs font-mono-acc uppercase tracking-widest">Name</Label>
          <Input data-testid="profile-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1.5 h-11" />
        </div>
        <div>
          <Label className="text-white/80 text-xs font-mono-acc uppercase tracking-widest">Preferred currency</Label>
          <Select value={form.preferred_currency} onValueChange={(v) => setForm({ ...form, preferred_currency: v })}>
            <SelectTrigger data-testid="profile-currency" className="bg-white/5 border-white/10 h-11 mt-1.5"><SelectValue/></SelectTrigger>
            <SelectContent className="glass-strong border-white/10 text-white">
              {["INR","USD","EUR","GBP","JPY","AUD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-white/80 text-xs font-mono-acc uppercase tracking-widest">Preferred language</Label>
          <Select value={form.preferred_language} onValueChange={(v) => setForm({ ...form, preferred_language: v })}>
            <SelectTrigger data-testid="profile-language" className="bg-white/5 border-white/10 h-11 mt-1.5"><SelectValue/></SelectTrigger>
            <SelectContent className="glass-strong border-white/10 text-white">
              {[["en","English"],["hi","Hindi"],["es","Spanish"],["fr","French"],["de","German"],["ja","Japanese"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button data-testid="profile-save" type="submit" disabled={saving} className="btn-primary text-white border-0 w-full h-11 rounded-full font-semibold">
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </main>
  );
}

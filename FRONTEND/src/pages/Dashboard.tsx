import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, CheckCircle2, AlertCircle, Clock,
  Users, Activity, Plus, Shield, Star,
  ChevronRight, BarChart3, Loader2, ArrowRight, MapPin, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/AuthContext";
import { api, getCurrentUserId, BloodRequest } from "@/lib/api";
import { toast } from "sonner";

const MODULE_CONFIG: Record<string, {
  key: string; label: string; emoji: string; path: string;
  color: string; bg: string; border: string; gradient: string; description: string;
  genderRestricted?: "male" | "female";
}> = {
  blood: { key: "blood", label: "Blood Donation", emoji: "🩸", path: "/blood-bridge", color: "text-blood", bg: "bg-blood/10", border: "border-blood/30", gradient: "from-red-600 to-rose-700", description: "Match with patients who urgently need your blood type." },
  platelet: { key: "platelet", label: "Platelet Donation", emoji: "⏱️", path: "/platelet-alert", color: "text-platelet", bg: "bg-platelet/10", border: "border-platelet/30", gradient: "from-amber-500 to-orange-600", description: "5-day viability window. Cancer patients depend on you." },
  milk: { key: "milk", label: "Milk Donation", emoji: "🍼", path: "/milk-bridge", color: "text-milk", bg: "bg-milk/10", border: "border-milk/30", gradient: "from-pink-400 to-rose-500", description: "Donate breast milk to save premature infants in NICUs.", genderRestricted: "female" },
  marrow: { key: "marrow", label: "Bone Marrow", emoji: "🧬", path: "/marrow-match", color: "text-marrow", bg: "bg-marrow/10", border: "border-marrow/30", gradient: "from-violet-600 to-purple-700", description: "HLA-compatible marrow donation — a second chance at life." },
  organ: { key: "organ", label: "Organ Donation", emoji: "🫁", path: "/last-gift", color: "text-organ", bg: "bg-organ/10", border: "border-organ/30", gradient: "from-teal-500 to-emerald-600", description: "Pledge your organs and give recipients a life-saving gift." },
};

const mockHistory = [
  { date: "Feb 15, 2025", type: "🩸 Blood", hospital: "Lilavati Hospital", status: "Fulfilled", impact: "3 lives saved" },
  { date: "Jan 28, 2025", type: "⏱️ Platelets", hospital: "Kokilaben Hospital", status: "Fulfilled", impact: "1 patient helped" },
  { date: "Jan 10, 2025", type: "🩸 Blood", hospital: "Breach Candy Hospital", status: "Fulfilled", impact: "2 lives saved" },
];

function ModuleCard({ mod, index }: { mod: typeof MODULE_CONFIG[string]; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}>
      <Link to={mod.path}>
        <div className={`group rounded-2xl border-2 ${mod.border} bg-card p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl ${mod.bg} flex items-center justify-center text-2xl`}>{mod.emoji}</div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all mt-1" />
          </div>
          <div className="font-display font-bold text-base text-foreground mb-0.5">{mod.label}</div>
          <p className="font-body text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
          {mod.genderRestricted && <Badge className="mt-2 text-[10px] bg-pink-100 text-pink-700 border-0 font-body">Women donors</Badge>}
        </div>
      </Link>
    </motion.div>
  );
}

function BloodModulePanel() {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const id = getCurrentUserId();
    if (!id) { setLoading(false); return; }
    api.blood.getRequestsForDonor(id).then(setRequests).catch(() => { }).finally(() => setLoading(false));
  }, []);
  return (
    <div className="rounded-2xl border-2 border-blood/20 bg-card overflow-hidden">
      <div className="bg-gradient-to-r from-red-600 to-rose-700 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🩸</span>
          <div><div className="font-display font-bold text-white text-base">Blood Donation</div><div className="font-body text-white/70 text-xs">Urgent requests matching your blood type</div></div>
        </div>
        <Link to="/blood-bridge"><Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 font-body text-xs rounded-lg">View All <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
      </div>
      <div className="p-4">
        {loading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blood" /></div>
          : requests.length === 0 ? <div className="text-center py-6"><Heart className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" /><p className="font-body text-sm text-muted-foreground">No urgent requests right now.</p></div>
            : <div className="space-y-2">{requests.slice(0, 3).map((req, i) => (
              <motion.div key={req.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-blood/20 p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blood/10 flex items-center justify-center font-display font-bold text-blood text-sm shrink-0">{req.group}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-body font-bold text-sm text-foreground truncate">{req.hospital}</div>
                  <div className="font-body text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{req.city} · <Clock className="w-3 h-3" />{req.posted}</div>
                </div>
                <Badge className={`text-[10px] border-0 font-body shrink-0 ${req.urgency === "CRITICAL" ? "bg-blood/15 text-blood" : "bg-platelet/15 text-platelet"}`}>{req.urgency}</Badge>
                <Button size="sm" onClick={() => toast.success(`Response sent to ${req.hospital}!`)} className="bg-blood text-white font-body font-semibold rounded-lg text-xs px-3 h-8 shrink-0">Respond</Button>
              </motion.div>
            ))}</div>}
      </div>
    </div>
  );
}

function PlateletModulePanel() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getCurrentUserId();
  useEffect(() => {
    api.platelet.getOpenRequests({ user_id: userId || undefined }).then(r => setRequests(r.slice(0, 3))).catch(() => { }).finally(() => setLoading(false));
  }, []);
  return (
    <div className="rounded-2xl border-2 border-platelet/20 bg-card overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⏱️</span>
          <div><div className="font-display font-bold text-white text-base">Platelet Donation</div><div className="font-body text-white/70 text-xs">Cancer patients with expiring windows</div></div>
        </div>
        <Link to="/platelet-alert"><Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 font-body text-xs rounded-lg">View All <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
      </div>
      <div className="p-4">
        {loading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-platelet" /></div>
          : requests.length === 0 ? <div className="text-center py-6"><Timer className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" /><p className="font-body text-sm text-muted-foreground">No urgent platelet requests right now.</p></div>
            : <div className="space-y-2">{requests.map((req, i) => (
              <motion.div key={req.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-platelet/20 p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-platelet/10 flex items-center justify-center font-display font-bold text-platelet text-sm shrink-0">{req.group}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-body font-bold text-sm text-foreground truncate">{req.patient}</div>
                  <div className="font-body text-xs text-muted-foreground">{req.cancer} · {req.hospital}</div>
                  <div className={`font-body text-[11px] font-bold mt-0.5 ${req.is_critical ? "text-blood" : "text-platelet"}`}>⏰ {req.expiry} remaining</div>
                </div>
                <Badge className={`text-[10px] border-0 font-body shrink-0 ${req.is_critical ? "bg-blood/15 text-blood" : "bg-platelet/15 text-platelet"}`}>{req.urgency}</Badge>
                <Button size="sm"
                  onClick={async () => { try { await api.platelet.createMatch({ request_id: req.id, donor_id: userId! }); toast.success("Donation intent recorded!"); } catch (e: any) { toast.error(e.message); } }}
                  className="bg-platelet text-white font-body font-semibold rounded-lg text-xs px-3 h-8 shrink-0">Donate</Button>
              </motion.div>
            ))}</div>}
      </div>
    </div>
  );
}

function SimpleModulePanel({ modKey }: { modKey: string }) {
  const mod = MODULE_CONFIG[modKey];
  if (!mod) return null;
  const tips: Record<string, string[]> = {
    milk: ["Pump or hand-express milk within 6 hours of feeding", "Store in sterile containers and keep refrigerated", "Milk bank will arrange pickup from your location"],
    marrow: ["Marrow donation is a one-time process for a specific patient", "HLA typing takes 2–4 weeks — stay available", "Recovery time is typically 2–3 weeks"],
    organ: ["Your pledge is documented — family will be informed", "Organs can save up to 8 lives after death", "You can update or revoke your pledge anytime"],
  };
  return (
    <div className={`rounded-2xl border-2 ${mod.border} bg-card overflow-hidden`}>
      <div className={`bg-gradient-to-r ${mod.gradient} px-5 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{mod.emoji}</span>
          <div><div className="font-display font-bold text-white text-base">{mod.label}</div><div className="font-body text-white/70 text-xs">{mod.description}</div></div>
        </div>
        <Link to={mod.path}><Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 font-body text-xs rounded-lg">Open Module <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
      </div>
      <div className="p-4">
        <p className="font-body text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Quick Tips</p>
        <div className="space-y-2">{(tips[modKey] || []).map((tip, i) => (
          <div key={i} className="flex items-start gap-2">
            <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${mod.color}`} />
            <p className="font-body text-xs text-muted-foreground">{tip}</p>
          </div>
        ))}</div>
      </div>
    </div>
  );
}

function DonorDashboard() {
  const [available, setAvailable] = useState(true);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const { userName, profile } = useAuth();
  const name = profile?.name || userName || "Donor";
  const initial = name.charAt(0).toUpperCase();
  const bloodGroup = profile?.blood_group || "—";
  const city = profile?.city || "—";
  const isVerified = profile?.is_verified ?? false;
  const trustScore = profile?.trust_score ? (profile.trust_score / 10).toFixed(1) : "5.0";
  const donorTypes = (profile?.donor_types || []) as string[];
  const activeModules = Object.values(MODULE_CONFIG).filter(m => donorTypes.includes(m.key));
  useEffect(() => { if (activeModules.length > 0 && !activeModule) setActiveModule(activeModules[0].key); }, [donorTypes]);

  return (
    <div className="space-y-6">
      {/* Profile Hero */}
      <div className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-foreground/20 flex items-center justify-center text-3xl font-bold font-display shrink-0">{initial}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-2xl font-bold">{name}</h2>
              {isVerified && <Badge className="bg-accent/20 text-accent border-0 font-body text-xs"><Shield className="w-3 h-3 mr-1" />Verified</Badge>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {activeModules.length > 0 ? activeModules.map(m => (
                <span key={m.key} className="inline-flex items-center gap-1 bg-primary-foreground/15 text-primary-foreground/90 text-[11px] font-body font-semibold px-2 py-0.5 rounded-full">{m.emoji} {m.label}</span>
              )) : <span className="font-body text-primary-foreground/60 text-sm">No donation types registered yet</span>}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1"><Star className="w-4 h-4 text-accent fill-current" /><span className="font-body text-sm font-bold">{trustScore} Trust Score</span></div>
              <span className="font-body text-sm text-primary-foreground/60">{city}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-body text-sm font-medium text-primary-foreground/80">Available</span>
            <button onClick={() => setAvailable(!available)} className={`w-12 h-6 rounded-full transition-all duration-300 relative ${available ? "bg-accent" : "bg-primary-foreground/30"}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-primary-foreground transition-all duration-300 ${available ? "right-1" : "left-1"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: "🩸", label: "Blood Group", value: bloodGroup, color: "text-blood" },
          { icon: "📍", label: "City", value: city, color: "text-primary" },
          { icon: "⭐", label: "Trust Score", value: trustScore, color: "text-accent" },
          { icon: "🎗️", label: "Modules Active", value: activeModules.length, color: "text-secondary" },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4 shadow-card text-center">
            <div className="text-2xl mb-1">{icon}</div>
            <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
            <div className="font-body text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {activeModules.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-10 text-center">
          <div className="text-4xl mb-3">🎗️</div>
          <h3 className="font-display text-lg font-bold mb-2">No donation types registered</h3>
          <p className="font-body text-sm text-muted-foreground">Your profile does not have any donor types set yet. Contact support or re-register.</p>
        </div>
      )}

      {/* Module Tabs */}
      {activeModules.length > 1 && (
        <div>
          <p className="font-body text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Your Donation Modules</p>
          <div className="flex flex-wrap gap-2">
            {activeModules.map(mod => (
              <button key={mod.key} onClick={() => setActiveModule(mod.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-body font-bold text-sm transition-all border-2 ${activeModule === mod.key ? `${mod.bg} ${mod.border} ${mod.color} shadow-sm` : "border-border bg-card text-muted-foreground hover:border-border/80"}`}>
                <span>{mod.emoji}</span><span>{mod.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Panel */}
      <AnimatePresence mode="wait">
        {activeModule && (
          <motion.div key={activeModule} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {activeModule === "blood" && <BloodModulePanel />}
            {activeModule === "platelet" && <PlateletModulePanel />}
            {(activeModule === "milk" || activeModule === "marrow" || activeModule === "organ") && <SimpleModulePanel modKey={activeModule} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Access Grid */}
      {activeModules.length > 1 && (
        <div>
          <p className="font-body text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Quick Access</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeModules.map((mod, i) => <ModuleCard key={mod.key} mod={mod} index={i} />)}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-secondary" />Donation History</h3>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>{["Date", "Type", "Hospital", "Status", "Impact"].map(h => <th key={h} className="font-body text-xs font-semibold text-muted-foreground px-4 py-3 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {mockHistory.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="font-body text-sm px-4 py-3 text-muted-foreground">{row.date}</td>
                  <td className="font-body text-sm px-4 py-3 font-medium">{row.type}</td>
                  <td className="font-body text-sm px-4 py-3 text-muted-foreground">{row.hospital}</td>
                  <td className="px-4 py-3"><Badge className="bg-secondary/15 text-secondary border-0 font-body text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />{row.status}</Badge></td>
                  <td className="font-body text-sm px-4 py-3 text-accent font-semibold">{row.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const HOSPITAL_MODULES = [
  { name: "BloodBridge", emoji: "🩸", tagline: "Blood donor matching", description: "Post urgent blood requests and match with verified donors in real time.", path: "/blood-bridge", accent: "border-blood/30 hover:border-blood", badge: "text-blood", icon_bg: "bg-blood/10" },
  { name: "ThalCare", emoji: "💉", tagline: "Thalassemia transfusions", description: "Manage recurring transfusion schedules and donor assignments for Thal patients.", path: "/thal-care", accent: "border-thal/30 hover:border-thal", badge: "text-thal", icon_bg: "bg-thal/10" },
  { name: "PlateletAlert", emoji: "⏱️", tagline: "Platelet expiry tracking", description: "Track platelet viability windows and match cancer patients with apheresis donors.", path: "/platelet-alert", accent: "border-platelet/30 hover:border-platelet", badge: "text-platelet", icon_bg: "bg-platelet/10" },
  { name: "MarrowMatch", emoji: "🧬", tagline: "HLA bone marrow matching", description: "Find HLA-compatible bone marrow donors with precision scoring.", path: "/marrow-match", accent: "border-marrow/30 hover:border-marrow", badge: "text-marrow", icon_bg: "bg-marrow/10" },
  { name: "LastGift", emoji: "🫁", tagline: "Organ donation & matching", description: "Manage organ recipient waitlists with viability timers and ranked matching.", path: "/last-gift", accent: "border-organ/30 hover:border-organ", badge: "text-organ", icon_bg: "bg-organ/10" },
  { name: "MilkBridge", emoji: "🍼", tagline: "Human milk bank", description: "Connect with lactating donors and manage milk bank inventory for NICUs.", path: "/milk-bridge", accent: "border-milk/30 hover:border-milk", badge: "text-milk", icon_bg: "bg-milk/10" },
];

function HospitalDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [thalPatients, setThalPatients] = useState<any[]>([]);
  const [plateletReqs, setPlateletReqs] = useState<any[]>([]);
  const [organRecips, setOrganRecips] = useState<any[]>([]);
  const [remLoading, setRemLoading] = useState(true);
  const hospitalId = getCurrentUserId();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hospitalId) { setLoading(false); return; }
    api.dashboard.getHospital(hospitalId).then(setData).catch(e => setError(e.message || "Failed to load dashboard")).finally(() => setLoading(false));
  }, [hospitalId]);

  useEffect(() => {
    const fetch = async () => {
      setRemLoading(true);
      try {
        const [thal, platelet, organ] = await Promise.allSettled([
          api.thal.getPatients(hospitalId || undefined),
          api.platelet.getOpenRequests({ user_id: hospitalId || undefined }),
          api.organ.getRecipients(),
        ]);
        if (thal.status === "fulfilled") setThalPatients(thal.value.filter((p: any) => p.days_until !== null && p.days_until <= 7));
        if (platelet.status === "fulfilled") setPlateletReqs(platelet.value.filter((p: any) => p.days_left <= 2));
        if (organ.status === "fulfilled") setOrganRecips(organ.value.slice(0, 3));
      } finally { setRemLoading(false); }
    };
    fetch();
  }, [hospitalId]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (error) return <div className="rounded-xl border-2 border-dashed border-border bg-card p-8 text-center"><p className="font-body text-muted-foreground mb-4">{error}</p><Button variant="outline" onClick={() => window.location.reload()}>Retry</Button></div>;

  const h = data?.hospital; const stats = data?.stats;
  const totalAlerts = thalPatients.length + plateletReqs.length + organRecips.length;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-foreground/20 flex items-center justify-center text-3xl shrink-0">🏥</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-2xl font-bold">{h?.name || "Hospital Dashboard"}</h2>
              {h?.is_verified ? <Badge className="bg-accent/20 text-accent border-0 font-body text-xs"><Shield className="w-3 h-3 mr-1" />Verified</Badge>
                : <Badge className="bg-muted/40 text-primary-foreground/60 border-0 font-body text-xs">Verification Pending</Badge>}
            </div>
            <p className="font-body text-primary-foreground/70 text-sm mt-0.5">{h?.city}</p>
          </div>
          <Button onClick={() => navigate("/blood-bridge")} className="bg-primary-foreground text-primary font-body font-bold rounded-xl shrink-0"><Plus className="w-4 h-4 mr-2" />Post Blood Request</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: "📋", label: "Active Requests", value: stats?.active_requests || 0, color: "text-platelet" },
          { icon: "✅", label: "Matched This Month", value: stats?.matched_this_month || 0, color: "text-secondary" },
          { icon: "🩸", label: "Units Received", value: stats?.units_received || 0, color: "text-blood" },
          { icon: "⏱️", label: "Avg Match Time", value: stats?.avg_match_time || "—", color: "text-organ" },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4 shadow-card text-center">
            <div className="text-2xl mb-1">{icon}</div>
            <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
            <div className="font-body text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-foreground">Platform Modules</h3>
          <span className="font-body text-xs text-muted-foreground">Click to open module</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HOSPITAL_MODULES.map((mod, i) => (
            <motion.div key={mod.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Link to={mod.path}>
                <div className={`group rounded-xl border-2 bg-card p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${mod.accent}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-11 h-11 rounded-xl ${mod.icon_bg} flex items-center justify-center text-2xl`}>{mod.emoji}</div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors mt-1" />
                  </div>
                  <div className="font-display font-bold text-base text-foreground mb-0.5">{mod.name}</div>
                  <div className={`font-body text-xs font-semibold mb-2 ${mod.badge}`}>{mod.tagline}</div>
                  <p className="font-body text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2"><AlertCircle className="w-5 h-5 text-primary" />Urgent Reminders</h3>
          {totalAlerts > 0 && <Badge className="bg-primary/10 text-primary border-0 font-body text-xs animate-pulse">{totalAlerts} Alerts</Badge>}
        </div>
        {remLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          : totalAlerts === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/20">
              <CheckCircle2 className="w-10 h-10 text-secondary mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground font-body font-semibold">No urgent reminders right now.</p>
              <p className="text-muted-foreground font-body text-xs mt-1">All patients and platelet requests are within safe windows.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {thalPatients.map((p: any, i: number) => (
                <motion.div key={p.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`rounded-xl border-2 bg-card p-4 flex items-center gap-4 ${p.is_urgent ? "border-blood/40 bg-blood/3" : "border-thal/30"}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${p.is_urgent ? "bg-blood/10" : "bg-thal/10"}`}>💉</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body font-bold text-sm">{p.name}</span>
                      <Badge className={`text-[10px] border-0 ${p.is_urgent ? "bg-blood/15 text-blood" : "bg-thal/15 text-thal"}`}>{p.is_urgent ? "OVERDUE / CRITICAL" : "DUE SOON"}</Badge>
                    </div>
                    <div className="font-body text-xs text-muted-foreground mt-0.5">💉 ThalCare · {p.group} · Next transfusion: <strong>{p.nextDate}</strong> · {p.countdown}</div>
                    <div className="font-body text-xs text-muted-foreground mt-0.5">Assigned donor: {p.donor} · {p.freq}</div>
                  </div>
                  <Link to="/thal-care"><Button size="sm" className="bg-thal/10 text-thal hover:bg-thal hover:text-white font-body font-semibold rounded-lg border border-thal/30 shrink-0">Manage</Button></Link>
                </motion.div>
              ))}
              {plateletReqs.map((p: any, i: number) => (
                <motion.div key={p.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (thalPatients.length + i) * 0.05 }}
                  className={`rounded-xl border-2 bg-card p-4 flex items-center gap-4 ${p.is_critical ? "border-blood/40 bg-blood/3" : "border-platelet/30"}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${p.is_critical ? "bg-blood/10" : "bg-platelet/10"}`}>⏱️</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body font-bold text-sm">{p.patient}</span>
                      <Badge className={`text-[10px] border-0 ${p.is_critical ? "bg-blood/15 text-blood" : "bg-platelet/15 text-platelet"}`}>{p.is_critical ? "EXPIRES TODAY/TOMORROW" : "EXPIRING SOON"}</Badge>
                    </div>
                    <div className="font-body text-xs text-muted-foreground mt-0.5">⏱️ PlateletAlert · {p.group} · {p.cancer !== "—" ? p.cancer : "Cancer patient"} · Expires in: <strong className="text-blood">{p.expiry}</strong></div>
                    <div className="font-body text-xs text-muted-foreground mt-0.5">{p.hospital} · {p.units} unit(s) needed</div>
                  </div>
                  <Link to="/platelet-alert"><Button size="sm" className="bg-platelet/10 text-platelet hover:bg-platelet hover:text-white font-body font-semibold rounded-lg border border-platelet/30 shrink-0">Act Now</Button></Link>
                </motion.div>
              ))}
              {organRecips.map((r: any, i: number) => (
                <motion.div key={r.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (thalPatients.length + plateletReqs.length + i) * 0.05 }}
                  className="rounded-xl border-2 border-organ/30 bg-card p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-organ/10 flex items-center justify-center text-xl shrink-0">🫁</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body font-bold text-sm">{r.name}</span>
                      <Badge className="text-[10px] border-0 bg-organ/15 text-organ">WAITING · Urgency {r.urgency}/10</Badge>
                    </div>
                    <div className="font-body text-xs text-muted-foreground mt-0.5">🫁 LastGift · Needs: <strong>{r.organ}</strong> · Blood: {r.blood} · Waiting: {r.wait}</div>
                    <div className="font-body text-xs text-muted-foreground mt-0.5">{r.hospital}{r.hospital_city ? `, ${r.hospital_city}` : ""}</div>
                  </div>
                  <Link to="/last-gift"><Button size="sm" className="bg-organ/10 text-organ hover:bg-organ hover:text-white font-body font-semibold rounded-lg border border-organ/30 shrink-0">View</Button></Link>
                </motion.div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

function BloodBankDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-red-600 to-red-800 p-6 text-primary-foreground">
        <h2 className="font-display text-2xl font-bold mb-2">🩸 Blood Bank Dashboard</h2>
        <p className="font-body text-primary-foreground/70 text-sm mb-4">Licensed Blood Collection & Storage Center</p>
        <div className="flex gap-3">
          <Button className="bg-primary-foreground text-red-700 font-body font-bold rounded-xl"><Plus className="w-4 h-4 mr-2" />Log New Collection</Button>
          <Button variant="outline" className="border-primary-foreground/40 text-primary-foreground font-body font-bold rounded-xl hover:bg-primary-foreground/10"><Activity className="w-4 h-4 mr-2" />View Inventory</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ icon: "🩸", label: "Units in Stock", value: "342", color: "text-blood" }, { icon: "📥", label: "Collected Today", value: "18", color: "text-secondary" }, { icon: "📤", label: "Dispatched Today", value: "12", color: "text-platelet" }, { icon: "⚠️", label: "Expiring Soon", value: "7", color: "text-organ" }].map(({ icon, label, value, color }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4 shadow-card text-center">
            <div className="text-2xl mb-1">{icon}</div><div className={`font-display text-2xl font-bold ${color}`}>{value}</div><div className="font-body text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-display text-lg font-bold mb-4">Blood Inventory by Group</h3>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {[{ group: "A+", units: 58, status: "ok" }, { group: "A-", units: 12, status: "low" }, { group: "B+", units: 74, status: "ok" }, { group: "B-", units: 8, status: "critical" }, { group: "AB+", units: 31, status: "ok" }, { group: "AB-", units: 5, status: "critical" }, { group: "O+", units: 96, status: "ok" }, { group: "O-", units: 3, status: "critical" }].map(({ group, units, status }) => (
            <div key={group} className={`rounded-xl border-2 p-3 text-center ${status === "critical" ? "border-blood bg-blood/5" : status === "low" ? "border-platelet bg-platelet/5" : "border-border bg-card"}`}>
              <div className="font-display text-lg font-bold">{group}</div>
              <div className={`font-display text-xl font-bold ${status === "critical" ? "text-blood" : status === "low" ? "text-platelet" : "text-foreground"}`}>{units}</div>
              <div className="font-body text-xs text-muted-foreground">units</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-display text-lg font-bold mb-4">Recent Dispatch Requests</h3>
        <div className="space-y-3">
          {[{ hospital: "KEM Hospital", group: "O-", units: 2, status: "Dispatched", time: "15 min ago" }, { hospital: "Lilavati Hospital", group: "B+", units: 3, status: "Pending", time: "45 min ago" }, { hospital: "Hinduja Hospital", group: "AB+", units: 1, status: "Dispatched", time: "1 hr ago" }].map((req, i) => (
            <div key={i} className="rounded-xl border-2 border-border bg-card p-4 flex items-center gap-4">
              <div className="text-2xl">🏥</div>
              <div className="flex-1"><span className="font-body font-bold text-sm">{req.hospital}</span><div className="font-body text-xs text-muted-foreground mt-0.5">{req.group} · {req.units} unit(s) · {req.time}</div></div>
              <Badge className={`text-xs border-0 font-body ${req.status === "Dispatched" ? "bg-secondary/15 text-secondary" : "bg-platelet/15 text-platelet"}`}>{req.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrphanageDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-primary-foreground">
        <h2 className="font-display text-2xl font-bold mb-2">🏠 Orphanage Dashboard</h2>
        <p className="font-body text-primary-foreground/70 text-sm mb-4">Registered Child Care Institution</p>
        <div className="flex gap-3">
          <Button className="bg-primary-foreground text-amber-700 font-body font-bold rounded-xl"><Plus className="w-4 h-4 mr-2" />Request Breast Milk</Button>
          <Button variant="outline" className="border-primary-foreground/40 text-primary-foreground font-body font-bold rounded-xl hover:bg-primary-foreground/10"><Users className="w-4 h-4 mr-2" />View Children</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ icon: "👶", label: "Children Under Care", value: "34", color: "text-platelet" }, { icon: "🍼", label: "Milk Received (L)", value: "28", color: "text-secondary" }, { icon: "💉", label: "Health Checkups Due", value: "5", color: "text-blood" }, { icon: "🤝", label: "Active Donors", value: "12", color: "text-organ" }].map(({ icon, label, value, color }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4 shadow-card text-center">
            <div className="text-2xl mb-1">{icon}</div><div className={`font-display text-2xl font-bold ${color}`}>{value}</div><div className="font-body text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-display text-lg font-bold mb-4">Pending Requests</h3>
        <div className="space-y-3">
          {[{ type: "🍼", need: "Breast Milk", qty: "5 liters", urgency: "URGENT", posted: "2 hrs ago" }, { type: "🩸", need: "Blood (B+)", qty: "2 units", urgency: "NORMAL", posted: "1 day ago" }, { type: "💊", need: "Thalassemia Screening", qty: "8 children", urgency: "SCHEDULED", posted: "3 days ago" }].map((req, i) => (
            <div key={i} className="rounded-xl border-2 border-border bg-card p-4 flex items-center gap-4">
              <div className="text-2xl">{req.type}</div>
              <div className="flex-1"><span className="font-body font-bold text-sm">{req.need}</span><div className="font-body text-xs text-muted-foreground mt-0.5">{req.qty} · Posted {req.posted}</div></div>
              <Badge className={`text-xs border-0 font-body ${req.urgency === "URGENT" ? "bg-blood/15 text-blood" : req.urgency === "SCHEDULED" ? "bg-muted text-muted-foreground" : "bg-secondary/15 text-secondary"}`}>{req.urgency}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NgoDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-primary-foreground">
        <h2 className="font-display text-2xl font-bold mb-2">🤝 NGO / Foundation Dashboard</h2>
        <p className="font-body text-primary-foreground/70 text-sm mb-4">Verified Non-Profit Organization</p>
        <div className="flex gap-3">
          <Button className="bg-primary-foreground text-emerald-700 font-body font-bold rounded-xl"><Plus className="w-4 h-4 mr-2" />Organize Drive</Button>
          <Button variant="outline" className="border-primary-foreground/40 text-primary-foreground font-body font-bold rounded-xl hover:bg-primary-foreground/10"><BarChart3 className="w-4 h-4 mr-2" />Impact Report</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ icon: "🎯", label: "Drives This Month", value: "6", color: "text-secondary" }, { icon: "👥", label: "Donors Mobilized", value: "284", color: "text-platelet" }, { icon: "🩸", label: "Units Collected", value: "152", color: "text-blood" }, { icon: "🏥", label: "Partner Hospitals", value: "11", color: "text-organ" }].map(({ icon, label, value, color }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4 shadow-card text-center">
            <div className="text-2xl mb-1">{icon}</div><div className={`font-display text-2xl font-bold ${color}`}>{value}</div><div className="font-body text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-display text-lg font-bold mb-4">Upcoming Drives</h3>
        <div className="space-y-3">
          {[{ name: "Mega Blood Drive — Dadar", date: "22 Feb, 9 AM", registered: 45, target: 100, status: "OPEN" }, { name: "Thalassemia Awareness Camp", date: "25 Feb, 10 AM", registered: 28, target: 50, status: "OPEN" }, { name: "Platelet Donation Drive — Andheri", date: "1 Mar, 8 AM", registered: 0, target: 60, status: "UPCOMING" }].map((drive, i) => (
            <div key={i} className="rounded-xl border-2 border-border bg-card p-4 flex items-center gap-4">
              <div className="text-2xl">📅</div>
              <div className="flex-1"><span className="font-body font-bold text-sm">{drive.name}</span><div className="font-body text-xs text-muted-foreground mt-0.5">{drive.date} · {drive.registered}/{drive.target} registered</div></div>
              <Badge className={`text-xs border-0 font-body ${drive.status === "OPEN" ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}>{drive.status}</Badge>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-display text-lg font-bold mb-4">Recent Impact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[{ label: "Lives Saved This Month", value: "47", icon: "❤️" }, { label: "Volunteer Hours", value: "320", icon: "⏰" }, { label: "Communities Reached", value: "8", icon: "🌍" }].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl bg-card border border-border p-5 shadow-card text-center">
              <div className="text-3xl mb-2">{icon}</div><div className="font-display text-3xl font-bold text-foreground">{value}</div><div className="font-body text-sm text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ icon: "🔍", label: "Pending Verifications", value: "142", color: "text-platelet", action: "Review" }, { icon: "🚩", label: "Flagged Accounts", value: "7", color: "text-blood", action: "Investigate" }, { icon: "👥", label: "Total Users", value: "12.4L", color: "text-secondary", action: "View All" }, { icon: "📊", label: "Today's Matches", value: "2,847", color: "text-organ", action: "Analytics" }].map(({ icon, label, value, color, action }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-5 shadow-card">
            <div className="text-2xl mb-2">{icon}</div><div className={`font-display text-3xl font-bold ${color} mb-1`}>{value}</div><div className="font-body text-xs text-muted-foreground mb-3">{label}</div>
            <Button size="sm" variant="outline" className="border-border font-body text-xs rounded-lg w-full">{action}<ChevronRight className="w-3 h-3 ml-auto" /></Button>
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-secondary" />Verification Queue</h3>
          <Badge className="bg-platelet/15 text-platelet border-0 font-body">142 pending</Badge>
        </div>
        <div className="space-y-3">
          {[{ name: "Priya Nair", type: "Donor", city: "Chennai", docs: "Aadhaar, Blood Report", time: "2h ago" }, { name: "Ramesh Blood Bank", type: "Hospital", city: "Pune", docs: "License, NABH", time: "4h ago" }, { name: "Kavita Deshpande", type: "Donor", city: "Nagpur", docs: "Aadhaar, HLA Report", time: "6h ago" }].map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-display font-bold text-foreground">{item.name[0]}</div>
              <div className="flex-1"><div className="font-body font-semibold text-sm text-foreground">{item.name}</div><div className="font-body text-xs text-muted-foreground">{item.type} · {item.city} · {item.docs} · {item.time}</div></div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-secondary text-secondary rounded-lg font-body text-xs">✓ Approve</Button>
                <Button size="sm" variant="outline" className="border-blood text-blood rounded-lg font-body text-xs">✗ Reject</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrgDashboardRouter() {
  const { orgType } = useAuth();
  switch (orgType) {
    case "bloodbank": return <BloodBankDashboard />;
    case "orphanage": return <OrphanageDashboard />;
    case "ngo": return <NgoDashboard />;
    case "hospital":
    default: return <HospitalDashboard />;
  }
}

export default function Dashboard() {
  const { role, userName } = useAuth();
  if (!role) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="font-display text-2xl font-bold text-foreground">Please log in first</h2>
        <p className="font-body text-muted-foreground">You need to be logged in to view the dashboard.</p>
        <Link to="/login"><Button className="bg-gradient-primary text-primary-foreground font-body font-bold rounded-xl">Go to Login</Button></Link>
      </div>
    </div>
  );
  const roleLabels: Record<string, string> = { donor: "🩸 Donor", hospital: "🏥 Hospital", admin: "🛡️ Admin" };
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-5 h-5 text-primary fill-current" />
            <span className="font-body text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dashboard</span>
            <Badge className="bg-muted text-muted-foreground border-0 font-body text-xs ml-2">{roleLabels[role]}</Badge>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">Welcome back, {userName} 👋</h1>
        </motion.div>
        {role === "donor" && <DonorDashboard />}
        {role === "hospital" && <OrgDashboardRouter />}
        {role === "admin" && <AdminDashboard />}
      </div>
      <Footer />
    </div>
  );
}
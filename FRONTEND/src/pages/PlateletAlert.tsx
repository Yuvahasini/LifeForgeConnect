import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Timer, Plus, Star, Loader2,
  Search, X, Heart, CheckCircle, XCircle, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  api, PlateletRequest, PlateletDonor,
  getCurrentUserId, isLoggedIn
} from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/AuthContext";

// ── Expiry Timer Bar ──────────────────────────────────────────────────────────
function ExpiryTimer({ label, hours }: { label: string; hours: number }) {
  const pct = Math.min(100, (hours / 120) * 100);
  const isCritical = hours < 48;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="font-body text-xs text-muted-foreground">{label}</span>
        <span className={`font-body text-xs font-bold ${isCritical ? "text-blood" : "text-platelet"}`}>
          {hours > 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h`}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isCritical ? "bg-blood" : "bg-platelet"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Match Status Badge ────────────────────────────────────────────────────────
function MatchBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-700", icon: <Clock className="w-3 h-3" /> },
    accepted: { label: "Accepted", cls: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
    declined: { label: "Declined", cls: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
    completed: { label: "Completed", cls: "bg-blue-100 text-blue-700", icon: <CheckCircle className="w-3 h-3" /> },
  };
  const cfg = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ── Urgency Filter Bar ────────────────────────────────────────────────────────
const URGENCY_OPTIONS = ["ALL", "CRITICAL", "URGENT", "NORMAL"];

export default function PlateletAlert() {
  const { role } = useAuth();
  const userId = getCurrentUserId();

  const [requests, setRequests] = useState<PlateletRequest[]>([]);
  const [donors, setDonors] = useState<PlateletDonor[]>([]);
  const [donorMatches, setDonorMatches] = useState<any[]>([]);
  const [hospitalMatches, setHospitalMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<"requests" | "donors" | "matches">("requests");

  const [formData, setFormData] = useState({
    patient_name: "", cancer_type: "", blood_group: "",
    units: 1, urgency: "urgent"
  });

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const params: any = { user_id: userId || undefined };
      if (urgencyFilter !== "ALL") params.urgency = urgencyFilter.toLowerCase();

      const [openRequests, compatibleDonors] = await Promise.all([
        api.platelet.getOpenRequests(params),
        api.platelet.getDonors(),
      ]);
      setRequests(openRequests);
      setDonors(compatibleDonors);

      // Fetch role-specific match data
      if (userId && role === "donor") {
        const dm = await api.platelet.getDonorMatches(userId);
        setDonorMatches(dm);
      }
      if (userId && role === "hospital") {
        const hm = await api.platelet.getHospitalMatches(userId);
        setHospitalMatches(hm);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not load latest platelet alerts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [urgencyFilter]);

  // ── Add patient (hospital only) ─────────────────────────────────────────────
  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn()) { toast.error("Please login as a hospital to post requests"); return; }
    if (role !== "hospital") { toast.error("Only verified hospitals can post patient requirements"); return; }
    if (!formData.patient_name || !formData.blood_group) {
      toast.error("Please fill in patient name and blood group"); return;
    }
    setIsSubmitting(true);
    try {
      await api.platelet.postRequest({ ...formData, hospital_id: userId });
      toast.success("Patient registered successfully!");
      setShowAddModal(false);
      setFormData({ patient_name: "", cancer_type: "", blood_group: "", units: 1, urgency: "urgent" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to register patient");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Donor clicks Donate ─────────────────────────────────────────────────────
  const handleDonate = async (request: PlateletRequest) => {
    if (!isLoggedIn()) { toast.error("Please login to donate"); return; }
    if (role !== "donor") { toast.error("Only registered donors can express donation intent"); return; }
    try {
      await api.platelet.createMatch({ request_id: request.id, donor_id: userId });
      toast.success("Donation intent recorded! The hospital will confirm shortly.", {
        icon: <Heart className="text-blood w-4 h-4" />
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to register donation intent");
    }
  };

  // ── Donor accepts or declines a match ───────────────────────────────────────
  const handleMatchUpdate = async (matchId: string, status: "accepted" | "declined") => {
    try {
      await api.platelet.updateMatch(matchId, { status, donor_id: userId });
      toast.success(`Match ${status}!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update match");
    }
  };

  // ── Filtered requests ────────────────────────────────────────────────────────
  const filteredRequests = urgencyFilter === "ALL"
    ? requests
    : requests.filter(r => r.urgency === urgencyFilter);

  const criticalCount = requests.filter(r => r.hours_left <= 24).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">

        {/* ── Hero ── */}
        <div className="bg-gradient-to-br from-platelet/90 to-amber-600/60 text-primary-foreground py-16 px-4">
          <div className="container mx-auto">
            <Link to="/" className="inline-flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground font-body text-sm mb-6">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-6xl">⏱️</div>
              <div>
                <h1 className="font-display text-5xl font-black">PlateletAlert</h1>
                <p className="font-body text-primary-foreground/70 text-lg">5-day expiry window. Zero tolerance for waste.</p>
              </div>
            </div>
            <div className="flex gap-6 mt-6 flex-wrap">
              {[
                { label: "Active Requests", value: requests.length },
                { label: "Expiring in 24h", value: criticalCount },
                { label: "Apheresis Donors", value: donors.length > 0 ? `${donors.length}+` : "…" },
              ].map(({ label, value }) => (
                <div key={label} className="glass rounded-xl px-5 py-3">
                  <div className="font-display text-2xl font-bold">{value}</div>
                  <div className="font-body text-xs text-primary-foreground/70">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10">

          {/* ── Role-aware info banner ── */}
          {isLoggedIn() && (
            <div className={`mb-6 rounded-2xl px-5 py-3 text-sm font-body flex items-center gap-2 ${role === "hospital"
              ? "bg-blue-50 border border-blue-200 text-blue-800"
              : "bg-green-50 border border-green-200 text-green-800"
              }`}>
              {role === "hospital" ? (
                <><span className="font-bold">Hospital view:</span> You can see real patient names and manage donation matches.</>
              ) : (
                <><span className="font-bold">Donor view:</span> Patient names are anonymized to protect privacy. You see blood type, units, and hospital.</>
              )}
            </div>
          )}

          {/* ── Tab bar (donor/hospital only) ── */}
          {isLoggedIn() && (role === "donor" || role === "hospital") && (
            <div className="flex gap-2 mb-6 bg-muted/40 rounded-2xl p-1 w-fit">
              {[
                { key: "requests", label: "Requests" },
                { key: "donors", label: "Donors" },
                {
                  key: "matches", label: role === "hospital" ? "Donation Matches" : "My Matches",
                  count: role === "donor" ? donorMatches.filter(m => m.status === "pending").length
                    : hospitalMatches.filter(m => m.status === "pending").length
                },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 rounded-xl font-body font-bold text-sm transition-all flex items-center gap-1.5 ${activeTab === tab.key
                    ? "bg-white shadow text-platelet"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {tab.label}
                  {tab.count ? (
                    <span className="bg-platelet text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Left Sidebar ── */}
            <div className="space-y-5">
              {/* Viability Clocks */}
              <div className="rounded-2xl border-2 border-platelet/20 bg-card p-5 shadow-card">
                <h3 className="font-display text-base font-bold mb-4 flex items-center gap-2">
                  <Timer className="w-5 h-5 text-platelet animate-pulse" /> Viability Clocks
                </h3>
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-platelet" /></div>
                  ) : requests.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-4 font-body italic">No active clocks</p>
                  ) : (
                    requests.slice(0, 3).map((r) => (
                      <div key={r.id} className="p-3 rounded-xl bg-platelet/5 border border-platelet/20">
                        <div className="font-body text-xs font-bold text-foreground mb-2">{r.patient} — {r.cancer}</div>
                        <ExpiryTimer label="Expiry" hours={r.hours_left} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Patient — hospital only */}
              {(!isLoggedIn() || role === "hospital") && (
                <div className="rounded-2xl border-2 border-platelet/20 bg-platelet/5 p-5">
                  <h3 className="font-display text-base font-bold mb-2">Post Platelet Need</h3>
                  <p className="font-body text-xs text-muted-foreground mb-3">
                    {role === "hospital"
                      ? "Register a cancer patient's platelet requirement."
                      : "Hospital login required to post patient requirements."}
                  </p>
                  <Button
                    onClick={() => {
                      if (role !== "hospital") { toast.error("Only verified hospitals can post requests"); return; }
                      setShowAddModal(true);
                    }}
                    disabled={role !== "hospital"}
                    className="w-full bg-platelet text-primary-foreground font-body font-bold rounded-xl h-12 shadow-lg shadow-platelet/20 hover:scale-[1.02] transition-transform disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Add Patient
                  </Button>
                </div>
              )}

              {/* Urgency filter */}
              <div className="rounded-2xl border-2 border-platelet/10 bg-card p-5">
                <h3 className="font-display text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">Filter by Urgency</h3>
                <div className="space-y-2">
                  {URGENCY_OPTIONS.map(u => (
                    <button
                      key={u}
                      onClick={() => setUrgencyFilter(u)}
                      className={`w-full text-left px-3 py-2 rounded-lg font-body text-sm font-bold transition-all ${urgencyFilter === u
                        ? "bg-platelet text-white"
                        : "hover:bg-platelet/10 text-muted-foreground"
                        }`}
                    >
                      {u === "ALL" ? "All Requests" : u}
                      {u !== "ALL" && (
                        <span className="ml-2 text-[10px] opacity-70">
                          ({requests.filter(r => r.urgency === u).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Main Content ── */}
            <div className="lg:col-span-2 space-y-6">

              {/* REQUESTS TAB */}
              {(activeTab === "requests" || !isLoggedIn()) && (
                <div>
                  <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
                    Urgent Platelet Requests
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-platelet" />}
                    <span className="ml-auto font-body text-sm font-normal text-muted-foreground">
                      {filteredRequests.length} shown
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {filteredRequests.length === 0 && !isLoading && (
                      <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/5">
                        <p className="text-muted-foreground font-body italic">No {urgencyFilter !== "ALL" ? urgencyFilter.toLowerCase() : ""} platelet requests found.</p>
                      </div>
                    )}
                    {filteredRequests.map((req, i) => (
                      <motion.div
                        key={req.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className={`rounded-xl border-2 bg-card p-4 flex items-center gap-4 transition-colors shadow-sm ${req.is_critical
                          ? "border-blood/40 hover:border-blood/60"
                          : "border-platelet/25 hover:border-platelet/50"
                          }`}
                      >
                        <div className="text-3xl">⏱️</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-body font-bold text-sm truncate">{req.patient}</span>
                            <Badge className={`text-[10px] px-1.5 h-4 border-0 font-body uppercase tracking-tighter ${req.is_critical ? "bg-blood/15 text-blood" : "bg-platelet/15 text-platelet"
                              }`}>
                              {req.urgency}
                            </Badge>
                          </div>
                          <div className="font-body text-xs text-muted-foreground mt-0.5 truncate">
                            {req.cancer} · {req.group} · {req.units} unit(s) · {req.hospital}
                          </div>
                          <div className={`font-body text-[11px] font-bold mt-1 ${req.is_critical ? "text-blood" : "text-platelet"}`}>
                            ⏰ Life Window: {req.expiry} remaining
                          </div>
                        </div>
                        {role === "donor" ? (
                          <Button
                            size="sm"
                            onClick={() => handleDonate(req)}
                            className="bg-platelet text-primary-foreground font-body font-bold rounded-lg px-4 h-9 whitespace-nowrap"
                          >
                            Donate
                          </Button>
                        ) : role === "hospital" ? (
                          <Badge className="bg-blue-100 text-blue-700 font-body text-xs">Your Patient</Badge>
                        ) : (
                          <Button size="sm" variant="outline" className="border-platelet/30 text-platelet font-body text-xs" onClick={() => toast.info("Login as a donor to help")}>
                            Login to Help
                          </Button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* DONORS TAB */}
              {activeTab === "donors" && (
                <div>
                  <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
                    Compatible Apheresis Donors
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-platelet" />}
                  </h3>
                  {donors.length === 0 && !isLoading && (
                    <div className="text-center py-10 bg-muted/20 border-2 border-dashed rounded-2xl">
                      <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                      <p className="text-muted-foreground font-body text-sm">No compatible donors currently available.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {donors.map((d, i) => (
                      <motion.div
                        key={d.id || i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-xl border-2 border-platelet/10 bg-card p-4 shadow-card hover:border-platelet/30 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-platelet/10 flex items-center justify-center text-xl font-display font-bold text-platelet mx-auto mb-3 group-hover:scale-110 transition-transform">
                          {d.name[0]}
                        </div>
                        <div className="font-body font-bold text-sm text-center text-foreground">{d.name}</div>
                        <div className="font-body text-[10px] text-center text-muted-foreground uppercase tracking-widest">{d.city}</div>
                        <div className="mt-4 p-3 rounded-xl bg-platelet/5 border border-platelet/10">
                          <div className="font-display font-black text-2xl text-center text-platelet leading-none">{d.compat}%</div>
                          <div className="font-body text-[9px] text-center text-muted-foreground uppercase mt-1">Compat. Score</div>
                        </div>
                        <div className="flex items-center gap-4 justify-between mt-4">
                          <div className="flex items-center gap-1 font-body text-xs font-bold">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {d.trust}
                          </div>
                          <div className="font-body text-[10px] text-secondary font-bold">NEXT: {d.nextAvail}</div>
                        </div>
                        {role === "hospital" && (
                          <Button size="sm" variant="outline"
                            className="w-full mt-4 border-platelet/30 text-platelet font-body font-bold text-xs rounded-lg hover:bg-platelet hover:text-white"
                            onClick={() => toast.success(`Request sent to ${d.name}!`)}
                          >
                            Request Apheresis
                          </Button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* MATCHES TAB */}
              {activeTab === "matches" && isLoggedIn() && (
                <div>
                  <h3 className="font-display text-xl font-bold mb-4 text-foreground">
                    {role === "hospital" ? "Donation Matches" : "My Donation Requests"}
                  </h3>

                  {/* DONOR: see their own match requests */}
                  {role === "donor" && (
                    <div className="space-y-3">
                      {donorMatches.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/5">
                          <p className="text-muted-foreground font-body italic">No donation requests yet. Click "Donate" on any request to get started.</p>
                        </div>
                      )}
                      {donorMatches.map((m, i) => (
                        <motion.div key={m.match_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                          className="rounded-xl border-2 border-platelet/20 bg-card p-4 flex items-center gap-4"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-body font-bold text-sm">{m.hospital}</span>
                              <MatchBadge status={m.status} />
                            </div>
                            <div className="font-body text-xs text-muted-foreground">
                              {m.cancer} · {m.group} · {m.units} unit(s) · {m.city}
                            </div>
                            <Badge className="mt-1 text-[10px] bg-platelet/10 text-platelet border-0">{m.urgency}</Badge>
                          </div>
                          {m.status === "pending" && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleMatchUpdate(m.match_id, "accepted")}
                                className="bg-green-600 hover:bg-green-700 text-white font-body text-xs h-8 px-3 rounded-lg">
                                Accept
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleMatchUpdate(m.match_id, "declined")}
                                className="border-red-300 text-red-600 hover:bg-red-50 font-body text-xs h-8 px-3 rounded-lg">
                                Decline
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* HOSPITAL: see all donation matches for their patients */}
                  {role === "hospital" && (
                    <div className="space-y-3">
                      {hospitalMatches.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/5">
                          <p className="text-muted-foreground font-body italic">No donors have responded to your requests yet.</p>
                        </div>
                      )}
                      {hospitalMatches.map((m, i) => (
                        <motion.div key={m.match_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                          className="rounded-xl border-2 border-platelet/20 bg-card p-4 flex items-center gap-4"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-body font-bold text-sm">{m.donor_name}</span>
                              <MatchBadge status={m.status} />
                            </div>
                            <div className="font-body text-xs text-muted-foreground">
                              {m.donor_blood} · {m.donor_city} · ⭐ {m.donor_trust}
                            </div>
                            <div className="font-body text-xs text-muted-foreground mt-0.5">
                              For patient: <span className="font-bold text-foreground">{m.patient_name}</span>
                            </div>
                          </div>
                          <MatchBadge status={m.status} />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Patient Modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-card rounded-3xl border-2 border-platelet/20 shadow-2xl overflow-hidden"
            >
              <div className="bg-platelet p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-display text-xl font-bold">New Platelet Request</h3>
                  <p className="text-white/70 text-xs font-body">Emergency registration for apheresis</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddPatient} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Patient Name</Label>
                  <Input required placeholder="Full name" className="rounded-xl font-body"
                    value={formData.patient_name}
                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Cancer Type</Label>
                    <Input placeholder="e.g. Leukemia" className="rounded-xl font-body"
                      value={formData.cancer_type}
                      onChange={(e) => setFormData({ ...formData, cancer_type: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Blood Group</Label>
                    <select className="w-full h-10 px-3 rounded-xl border-2 border-input bg-background font-body text-sm"
                      value={formData.blood_group} required
                      onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}>
                      <option value="">Select Group</option>
                      {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Units Needed</Label>
                    <Input type="number" min={1} max={10} className="rounded-xl font-body"
                      value={formData.units}
                      onChange={(e) => setFormData({ ...formData, units: parseInt(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Urgency</Label>
                    <div className="flex bg-muted p-1 rounded-xl gap-1">
                      {["urgent", "critical"].map(u => (
                        <button key={u} type="button"
                          onClick={() => setFormData({ ...formData, urgency: u })}
                          className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${formData.urgency === u ? "bg-white text-platelet shadow-sm" : "text-muted-foreground hover:bg-white/50"
                            }`}>{u}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <Button type="submit" disabled={isSubmitting}
                  className="w-full bg-platelet text-white font-bold h-12 rounded-xl mt-4">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Alert"}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
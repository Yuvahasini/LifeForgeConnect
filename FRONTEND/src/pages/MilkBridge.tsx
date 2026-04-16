/**
 * MilkBridge.tsx — v3 Final (Bug-fixed)
 *
 * Bug fixes applied:
 *   BUG FIX 1: Active Requests now shows posted requests — HospRequest type has
 *              status field, and the filter correctly matches "open" / "donor_contacted".
 *   BUG FIX 2: Kara-type direct donors now appear in Matched Donors — backend
 *              auto-creates milk_matches row; dashboard also pulls direct donations.
 *   BUG FIX 3: After Log & Complete, the request is closed (status -> fulfilled)
 *              and disappears from Critical Shortages. Guard added to warn if
 *              requestId is missing before submitting.
 *   BUG FIX 4: Log & Complete volume pre-fills from actual match quantity (not hardcoded).
 *   BUG FIX 5: logDonation passes request_id so the backend closes the milk_request.
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, QrCode, Plus, Heart, AlertTriangle, Loader2,
  Sparkles, X, RefreshCw, CheckCircle2, Clock,
  MapPin, History, ClipboardList, Building2, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  api, MilkDonor, MilkBankRow, MilkShortageAlert,
  getCurrentUserId, isLoggedIn,
} from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/AuthContext";

// ── Local types ───────────────────────────────────────────────────────────────

interface DonorMatch {
  id: string;
  request_id: string;
  hospital_name: string;
  hospital_city: string;
  volume_ml: number;
  urgency: string;
  status: string;
  pickup_date?: string;
  pickup_time?: string;
  created_at: string;
  responded_at?: string;
}

interface HospMatchedDonor {
  id: string;
  donor_id: string;
  milk_donor_id?: string;
  donor_name: string;
  city: string;
  quantity_ml?: number;
  status: string;
  request_id: string;
  pickup_date?: string;
  pickup_time?: string;
}

// BUG FIX 1: Added status field — previously missing, which caused
// .filter(r => ["open","donor_contacted"].includes(r.status)) to always
// return [] because TypeScript typed r.status as undefined.
interface HospRequest {
  id: string;
  infant_ref: string;
  volume_ml?: number;
  urgency: string;
  status: string;   // ← FIX: was missing from the original interface
  created_at: string;
}

interface HospDash {
  hospital: { id: string; name: string; city: string };
  stats: {
    active_requests: number;
    pending_matches: number;
    accepted_matches: number;
    total_received_ml: number;
    donations_received: number;
  };
  active_requests: HospRequest[];
  matched_donors: HospMatchedDonor[];
  donation_history: Array<{ passport_id: string; donor_name: string; volume_ml: number; date: string; status: string }>;
}

interface MatchResult {
  milk_donor_id: string;
  donor_id: string;
  name: string;
  city: string;
  quantity_ml: number;
  distance: string;
  match_score: number;
  verified: boolean;
}

// BUG FIX 4 & 5: logModal carries volMl from the actual match AND requestId
// so the backend can close the shortage on completion.
interface LogModal {
  matchId: string;
  donorId: string;
  hospId: string;
  requestId?: string;   // ← used to close shortage (BUG FIX 5)
  volMl: number;        // ← pre-filled from match.quantity_ml (BUG FIX 4)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function urgencyClass(u: string) {
  if (u === "CRITICAL") return "bg-blood/15 text-blood animate-pulse";
  if (u === "URGENT") return "bg-platelet/15 text-platelet";
  return "bg-muted text-muted-foreground";
}

function statusClass(s: string) {
  const m: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    accepted: "bg-secondary/15 text-secondary",
    pickup_scheduled: "bg-blue-100 text-blue-700",
    collected: "bg-purple-100 text-purple-700",
    delivered: "bg-green-100 text-green-700",
    declined: "bg-blood/10 text-blood",
  };
  return m[s] ?? "bg-muted text-muted-foreground";
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    pending: "Pending",
    accepted: "ACCEPTED",
    pickup_scheduled: "Pickup Scheduled",
    collected: "COLLECTED",
    delivered: "Delivered",
    declined: "Declined",
  };
  return m[s] ?? s.toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function MilkBridge() {
  const { role } = useAuth();
  const userId = getCurrentUserId();
  const isDonor = role === "donor";
  const isHospital = role === "hospital";

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"overview" | "my" | "bank">("overview");

  // ── Shared data ───────────────────────────────────────────────────────────
  const [donors, setDonors] = useState<MilkDonor[]>([]);
  const [milkBank, setMilkBank] = useState<MilkBankRow[]>([]);
  const [shortages, setShortages] = useState<MilkShortageAlert[]>([]);
  const [sharedLoading, setSharedLoading] = useState(true);

  // ── Donor state ───────────────────────────────────────────────────────────
  const [donorMatches, setDonorMatches] = useState<DonorMatch[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [donorForm, setDonorForm] = useState({ babyAge: "", qty: 0, location: "", anon: false });
  const [registerLoading, setRegisterLoading] = useState(false);

  // ── Hospital state ────────────────────────────────────────────────────────
  const [hospDash, setHospDash] = useState<HospDash | null>(null);
  const [hospLoading, setHospLoading] = useState(false);
  const [findingId, setFindingId] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [matchingReqId, setMatchingReqId] = useState<string | null>(null);
  const [showShortage, setShowShortage] = useState(false);
  const [shortageForm, setShortageForm] = useState({ infantName: "", qtyMl: 150, urgency: "urgent" });
  const [postingShortage, setPostingShortage] = useState(false);

  const [logModal, setLogModal] = useState<LogModal | null>(null);
  const [logForm, setLogForm] = useState({ volMl: 200, pasteurized: true, date: new Date().toISOString().slice(0, 10) });
  const [logLoading, setLogLoading] = useState(false);

  const [trackingRow, setTrackingRow] = useState<MilkBankRow | null>(null);

  // ── Fetch shared ──────────────────────────────────────────────────────────
  const fetchShared = useCallback(async () => {
    try {
      const [d, b, a] = await Promise.all([
        api.milk.getDonors(),
        api.milk.getBank(),
        api.milk.getShortageAlerts(),
      ]);
      setDonors(d);
      setMilkBank(b as MilkBankRow[]);
      setShortages(a as MilkShortageAlert[]);
    } catch {
      toast.error("Could not load MilkBridge data");
    } finally {
      setSharedLoading(false);
    }
  }, []);

  const fetchDonorMatches = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await api.milk.getDonorMatches(userId);
      setDonorMatches(data as DonorMatch[]);
    } catch (e: any) {
      toast.error(e.message || "Failed to load your matches");
    }
  }, [userId]);

  const fetchHospDash = useCallback(async () => {
    if (!userId) return;
    setHospLoading(true);
    try {
      const data = await api.milk.getHospitalDashboard(userId);
      setHospDash(data as HospDash);
    } catch (e: any) {
      toast.error(e.message || "Failed to load hospital dashboard");
    } finally {
      setHospLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchShared();
    if (isDonor) fetchDonorMatches();
    if (isHospital) fetchHospDash();
  }, [fetchShared, fetchDonorMatches, fetchHospDash, isDonor, isHospital]);

  // ── Milk bank filtered for donors ─────────────────────────────────────────
  const visibleMilkBank = isDonor
    ? milkBank.filter(row => (row as any).donor_id === userId)
    : milkBank;

  // ── Register donor ────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn()) { toast.error("Please login to register"); return; }
    if (!donorForm.babyAge || donorForm.qty <= 0) { toast.error("Fill baby age and quantity"); return; }
    setRegisterLoading(true);
    try {
      await api.milk.registerDonor({
        donor_id: userId,
        baby_age_months: parseInt(donorForm.babyAge) || 1,
        quantity_ml_per_day: donorForm.qty,
        pickup_location: donorForm.location || undefined,
        is_anonymous: donorForm.anon,
      });
      toast.success("Registered as milk donor! 🍼");
      setDonorForm({ babyAge: "", qty: 0, location: "", anon: false });
      fetchShared();
    } catch (e: any) {
      toast.error(e.message || "Failed to register");
    } finally {
      setRegisterLoading(false);
    }
  };

  // ── Donor: respond to match ───────────────────────────────────────────────
  const handleRespond = async (matchId: string, action: "accepted" | "declined") => {
    if (!userId) return;
    setRespondingId(matchId);
    try {
      await api.milk.respondToMatch(matchId, { donor_id: userId, status: action });
      toast.success(action === "accepted"
        ? "Accepted! The hospital will schedule pickup. 🍼"
        : "Response recorded.");
      fetchDonorMatches();
    } catch (e: any) {
      toast.error(e.message || "Failed to respond");
    } finally {
      setRespondingId(null);
    }
  };

  // ── Donor: I Can Help ─────────────────────────────────────────────────────
  const handleICanHelp = async (alertId: string) => {
    if (!isLoggedIn()) { toast.error("Please login to respond"); return; }
    if (!isDonor) { toast.error("Only registered donors can respond"); return; }
    try {
      await api.milk.createMatch({ request_id: alertId, donor_id: userId });
      toast.success("Intent recorded! The hospital will be notified. 🍼");
      fetchDonorMatches();
      setTab("my");
    } catch (e: any) {
      toast.error(e.message || "Failed to register interest");
    }
  };

  // ── Hospital: post shortage ───────────────────────────────────────────────
  const handlePostShortage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { toast.error("Please login as hospital"); return; }
    setPostingShortage(true);
    try {
      await api.milk.postRequest({
        hospital_id: userId,
        infant_name: shortageForm.infantName || undefined,
        daily_quantity_ml: shortageForm.qtyMl,
        urgency: shortageForm.urgency,
      });
      toast.success("Shortage alert posted! Donors are being notified.");
      setShowShortage(false);
      setShortageForm({ infantName: "", qtyMl: 150, urgency: "urgent" });
      // Refresh both shared shortages AND the hospital dashboard
      fetchShared();
      fetchHospDash();
    } catch (e: any) {
      toast.error(e.message || "Failed to post shortage");
    } finally {
      setPostingShortage(false);
    }
  };

  // ── Hospital: find matches ────────────────────────────────────────────────
  const handleFindMatches = async (req: HospRequest) => {
    setFindingId(req.id);
    setMatchingReqId(req.id);
    try {
      const res: any = await api.milk.findMatches({ request_id: req.id, max_distance_km: 200 });
      setMatchResults(res.matches || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to find matches");
      setMatchResults([]);
    } finally {
      setFindingId(null);
    }
  };

  // ── Hospital: create match from results ───────────────────────────────────
  const handleCreateMatch = async (m: MatchResult) => {
    if (!matchingReqId) return;
    try {
      await api.milk.createMatch({
        request_id: matchingReqId,
        donor_id: m.donor_id,
        milk_donor_id: m.milk_donor_id,
      });
      toast.success(`${m.name} has been matched and notified!`);
      setMatchResults(null);
      setMatchingReqId(null);
      fetchHospDash();
    } catch (e: any) {
      toast.error(e.message || "Failed to create match");
    }
  };

  // ── Hospital: update match status ─────────────────────────────────────────
  const handleMatchStatus = async (matchId: string, status: string) => {
    try {
      await api.milk.updateMatchStatus(matchId, { status });
      toast.success(`Marked as ${status.replace("_", " ")}!`);
      fetchHospDash();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  };

  // ── Hospital: Log & Complete ──────────────────────────────────────────────
  // BUG FIX 3, 4, 5:
  //   - volMl is pre-filled from the actual match quantity (not hardcoded 300)
  //   - requestId is passed through so the backend closes the milk_request
  //   - Guard warns if requestId is missing (indicates a data integrity issue)
  const handleLogComplete = async () => {
    if (!logModal || !userId) return;
    if (!logModal.donorId || logModal.donorId.trim() === "") {
      toast.error("Donor ID missing — please refresh and try again.");
      return;
    }

    // BUG FIX 3: Warn if requestId missing — shortage won't close without it
    if (!logModal.requestId) {
      console.warn("[MilkBridge] logModal.requestId is undefined — shortage will NOT be closed after this donation.");
    }

    setLogLoading(true);
    try {
      await api.milk.logDonation({
        donor_id: logModal.donorId,
        // BUG FIX 5: pass requestId so backend sets milk_request.status = "fulfilled"
        request_id: logModal.requestId ?? undefined,
        collection_date: logForm.date,
        volume_ml: logForm.volMl,
        pasteurized: logForm.pasteurized,
        pasteurization_date: logForm.pasteurized ? logForm.date : undefined,
        pasteurization_method: logForm.pasteurized ? "Holder pasteurization" : undefined,
        receiving_hospital_id: logModal.hospId,
      });
      await api.milk.updateMatchStatus(logModal.matchId, { status: "delivered" });
      toast.success("Donation logged! Milk Bank updated and request closed. 🍼");
      setLogModal(null);
      // Refresh shortages + dashboard so the closed request disappears
      fetchShared();
      fetchHospDash();
    } catch (e: any) {
      toast.error(e.message || "Failed to log donation");
      console.error("[MilkBridge] handleLogComplete error:", e);
    } finally {
      setLogLoading(false);
    }
  };

  const handleViewQR = (row: MilkBankRow) => setTrackingRow(row);

  // ── Derived ───────────────────────────────────────────────────────────────
  const pendingMatches = donorMatches.filter(m => m.status === "pending");
  const activeMatches = donorMatches.filter(m => ["accepted", "pickup_scheduled", "collected"].includes(m.status));
  const historyMatches = donorMatches.filter(m => ["delivered", "declined"].includes(m.status));
  const acceptedCount = (hospDash?.matched_donors || []).filter(
    m => ["accepted", "pickup_scheduled", "collected"].includes(m.status)
  ).length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-16">

        {/* Hero */}
        <div className="bg-gradient-to-br from-milk/90 to-amber-400/60 py-16 px-4">
          <div className="container mx-auto">
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-foreground/60 hover:text-foreground font-body text-sm mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-6xl">🍼</div>
              <div>
                <h1 className="font-display text-5xl font-black">MilkBridge</h1>
                <p className="font-body text-foreground/60 text-lg">Nourishing India's tiniest lives</p>
              </div>
            </div>
            <div className="flex gap-6 mt-6 flex-wrap">
              {[
                { label: "Active Donors", value: sharedLoading ? "—" : donors.length },
                { label: "Babies Helped", value: "12,400+" },
                { label: "Donations Logged", value: sharedLoading ? "—" : milkBank.length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/20 rounded-xl px-5 py-3 backdrop-blur-md border border-white/30">
                  <div className="font-display text-2xl font-bold">{value}</div>
                  <div className="font-body text-xs text-foreground/70">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="border-b border-border bg-card sticky top-16 z-10">
          <div className="container mx-auto px-4">
            <div className="flex gap-1 py-2">
              {[
                { key: "overview", label: "Overview" },
                { key: "my", label: isDonor ? "My Donations" : isHospital ? "Hospital Dashboard" : "My Activity" },
                { key: "bank", label: "Milk Bank" },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setTab(key as any)}
                  className={`px-5 py-2 rounded-lg font-body text-sm font-semibold transition-all ${tab === key ? "bg-milk text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10">

          {/* ════ OVERVIEW TAB ════ */}
          {tab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Sidebar */}
              <div className="space-y-6">
                {isDonor && (
                  <div className="rounded-2xl border-2 border-milk/30 bg-card p-6 shadow-card">
                    <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-milk" /> Register to Donate
                      <Badge className="bg-milk/20 text-milk border-0 font-body text-[10px] ml-auto uppercase font-black">NICU Priority</Badge>
                    </h3>
                    <form onSubmit={handleRegister} className="space-y-3">
                      <div>
                        <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Baby's Age (Months)</Label>
                        <Input type="number" placeholder="e.g. 3" className="h-11 rounded-xl mt-1"
                          value={donorForm.babyAge} onChange={e => setDonorForm(p => ({ ...p, babyAge: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ML Available Daily</Label>
                        <Input type="number" placeholder="e.g. 200" className="h-11 rounded-xl mt-1"
                          value={donorForm.qty || ""} onChange={e => setDonorForm(p => ({ ...p, qty: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div>
                        <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location / City</Label>
                        <Input placeholder="City/Area" className="h-11 rounded-xl mt-1"
                          value={donorForm.location} onChange={e => setDonorForm(p => ({ ...p, location: e.target.value }))} />
                      </div>
                      <Button type="submit" disabled={registerLoading}
                        className="w-full bg-milk text-foreground font-body font-bold rounded-xl h-12">
                        {registerLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Start Donating"}
                      </Button>
                    </form>
                  </div>
                )}

                {/* Shortage alerts sidebar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Critical Shortages</h3>
                    {isHospital && (
                      <button onClick={() => setShowShortage(true)}
                        className="text-[10px] font-bold text-blood hover:underline uppercase tracking-tighter">
                        + Post Need
                      </button>
                    )}
                  </div>
                  {sharedLoading ? (
                    <div className="p-8 text-center bg-muted/20 rounded-2xl animate-pulse">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-milk/50" />
                    </div>
                  ) : shortages.length === 0 ? (
                    <div className="p-6 text-center bg-secondary/5 border-2 border-dashed border-secondary/20 rounded-2xl">
                      <Sparkles className="w-5 h-5 text-secondary mx-auto mb-2" />
                      <p className="font-body text-xs text-muted-foreground">Stock levels stable.</p>
                    </div>
                  ) : shortages.map(a => (
                    <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      className="rounded-2xl border-2 border-blood/20 bg-blood/5 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-blood animate-pulse" />
                        <span className="font-display text-xs font-bold text-blood uppercase">{a.hospital}</span>
                        <Badge className={`text-[9px] border-0 font-body ml-auto ${urgencyClass((a as any).urgency || "URGENT")}`}>
                          {(a as any).urgency || "URGENT"}
                        </Badge>
                      </div>
                      <p className="font-body text-xs text-muted-foreground mb-3">{a.city} · {a.quantity_needed}</p>
                      {isDonor && (
                        <Button onClick={() => handleICanHelp(a.id)}
                          className="w-full bg-blood text-white font-body font-bold rounded-xl h-9 text-xs">
                          I Can Help
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Main area */}
              <div className="lg:col-span-2 space-y-6">
                {!isDonor ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl font-bold flex items-center gap-2">
                        Verified Milk Donors
                        {sharedLoading && <Loader2 className="w-4 h-4 animate-spin text-milk" />}
                      </h3>
                      <Badge variant="outline" className="font-body text-[10px] text-milk border-milk/30">LATEST UPDATES</Badge>
                    </div>
                    {!sharedLoading && donors.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed rounded-3xl bg-muted/5">
                        <p className="font-body text-muted-foreground">No active donors listed in this cycle.</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {donors.map((d, i) => (
                        <motion.div key={d.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="rounded-3xl border-2 border-milk/10 bg-card p-5 shadow-card hover:border-milk/40 transition-all group">
                          <div className="w-14 h-14 rounded-2xl bg-milk/10 flex items-center justify-center text-3xl mx-auto mb-4 group-hover:scale-110 transition-transform">🤱</div>
                          <div className="text-center mb-3">
                            <div className="font-display font-bold text-md flex items-center justify-center gap-1.5">
                              {d.name}
                              {d.verified && <Sparkles size={14} className="text-amber-500 fill-amber-500" />}
                            </div>
                            <div className="font-body text-[11px] text-muted-foreground mt-0.5">Baby Age: {d.babyAge}</div>
                            <div className="font-body text-[10px] text-muted-foreground">{d.area}</div>
                          </div>
                          <div className="p-3 rounded-2xl bg-milk/5 border border-milk/20 text-center mb-3">
                            <div className="font-display font-black text-xl text-milk">{d.qty}</div>
                            <div className="font-body text-[10px] font-bold text-muted-foreground uppercase opacity-70">daily surplus</div>
                          </div>
                          <Badge className="w-full justify-center bg-secondary/10 text-secondary border-0 font-body text-[10px] mb-3">❤️ {d.impact}</Badge>
                          {isHospital && (
                            <Button size="sm" onClick={() => toast.info(`Contact request sent to ${d.name}.`)}
                              className="w-full bg-milk text-foreground font-body text-xs font-bold rounded-xl h-9">
                              Request Milk
                            </Button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </>
                ) : (
                  /* Donor sees NICU shortage alerts in the main area */
                  <div className="space-y-4">
                    <h3 className="font-display text-xl font-bold flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-blood animate-pulse" />
                      Active NICU Requests
                    </h3>
                    {shortages.length === 0 ? (
                      <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-muted/5">
                        <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-4 opacity-40" />
                        <p className="font-body text-muted-foreground">No critical shortages right now.</p>
                        <p className="font-body text-sm text-muted-foreground mt-1">You'll be notified when NICUs need help.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {shortages.map((a, i) => (
                          <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border-2 border-blood/20 bg-card p-5">
                            <div className="flex items-start justify-between mb-2">
                              <div className="w-9 h-9 rounded-xl bg-blood/10 flex items-center justify-center text-xl">🏥</div>
                              <Badge className={`text-[10px] border-0 font-body font-black uppercase ${urgencyClass((a as any).urgency || "URGENT")}`}>
                                {(a as any).urgency || "URGENT"}
                              </Badge>
                            </div>
                            <div className="font-display font-bold text-sm mb-0.5">{a.hospital}</div>
                            <div className="font-body text-xs text-muted-foreground flex items-center gap-1 mb-2">
                              <MapPin className="w-3 h-3" /> {a.city}
                            </div>
                            <div className="font-display font-black text-milk text-sm mb-3">{a.quantity_needed}</div>
                            <Button onClick={() => handleICanHelp(a.id)}
                              className="w-full bg-blood text-white font-body font-bold rounded-xl h-9 text-xs">
                              I Can Help
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ MY TAB — DONOR ════ */}
          {tab === "my" && isDonor && (
            <div className="space-y-8">
              {/* Requests Waiting for Response */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-milk" /> Requests Waiting for Your Response
                  </h3>
                  <Button variant="ghost" size="sm" onClick={fetchDonorMatches}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                {pendingMatches.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/5">
                    <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="font-body text-muted-foreground">No pending requests right now.</p>
                    <p className="font-body text-xs text-muted-foreground mt-1">You'll be notified when a NICU needs your help.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingMatches.map((m, i) => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl border-2 border-milk/20 bg-card p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-milk/10 flex items-center justify-center text-2xl shrink-0">🏥</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-display font-bold text-base">{m.hospital_name}</span>
                              <Badge className={`text-[10px] border-0 font-body font-black uppercase ${urgencyClass(m.urgency)}`}>{m.urgency}</Badge>
                            </div>
                            <div className="font-body text-xs text-muted-foreground flex items-center gap-3">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.hospital_city}</span>
                              <span className="font-bold text-milk">{m.volume_ml}ml/day</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <Button onClick={() => handleRespond(m.id, "accepted")}
                              disabled={respondingId === m.id}
                              className="bg-secondary text-white font-body font-bold rounded-xl h-9 px-4 text-xs">
                              {respondingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Accept</>}
                            </Button>
                            <Button onClick={() => handleRespond(m.id, "declined")}
                              disabled={respondingId === m.id}
                              variant="outline" size="sm" className="rounded-xl font-body text-xs border-border h-9">
                              <X className="w-3.5 h-3.5 mr-1" /> Decline
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nearby NICU Requests */}
              {shortages.length > 0 && (
                <div>
                  <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-milk" /> Nearby NICU Requests
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {shortages.map((a, i) => (
                      <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl border-2 border-milk/20 bg-card p-5">
                        <div className="flex items-start justify-between mb-2">
                          <div className="w-9 h-9 rounded-xl bg-milk/10 flex items-center justify-center text-xl">🏥</div>
                          <Badge className={`text-[10px] border-0 font-body font-black uppercase ${urgencyClass((a as any).urgency || "URGENT")}`}>
                            {(a as any).urgency || "URGENT"}
                          </Badge>
                        </div>
                        <div className="font-display font-bold text-sm mb-0.5">{a.hospital}</div>
                        <div className="font-body text-xs text-muted-foreground flex items-center gap-1 mb-1">
                          <MapPin className="w-3 h-3" /> {a.city}
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="font-display font-black text-milk text-sm">{a.quantity_needed}</span>
                          {(a as any).time_left && (
                            <span className="font-body text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {(a as any).time_left}
                            </span>
                          )}
                        </div>
                        <Button onClick={() => handleICanHelp(a.id)}
                          className="w-full bg-milk text-foreground font-body font-bold rounded-xl h-9 text-xs">
                          I Can Help
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Your Active Donations */}
              {activeMatches.length > 0 && (
                <div>
                  <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-milk" /> Your Active Donations
                  </h3>
                  <div className="space-y-3">
                    {activeMatches.map((m, i) => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="rounded-2xl border-2 border-secondary/20 bg-secondary/5 p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-milk/10 flex items-center justify-center text-xl">🏥</div>
                            <div>
                              <div className="font-display font-bold text-sm">{m.hospital_name}</div>
                              <div className="font-body text-xs text-muted-foreground">{m.hospital_city} · {m.volume_ml}ml/day</div>
                            </div>
                          </div>
                          <Badge className={`font-body text-xs border-0 ${statusClass(m.status)}`}>{statusLabel(m.status)}</Badge>
                        </div>
                        {m.status === "accepted" && <p className="font-body text-xs text-muted-foreground mt-2 italic">Hospital will schedule pickup soon...</p>}
                        {m.status === "pickup_scheduled" && (
                          <p className="font-body text-xs text-secondary mt-2 font-semibold">
                            Pickup scheduled{m.pickup_date ? ` for ${m.pickup_date}` : ""}. Keep milk refrigerated!
                          </p>
                        )}
                        {m.status === "collected" && <p className="font-body text-xs text-secondary mt-2 font-semibold">Your donation has been collected. Thank you!</p>}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Donations */}
              {historyMatches.length > 0 && (
                <div>
                  <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
                    <History className="w-5 h-5 text-muted-foreground" /> Past Donations
                  </h3>
                  <div className="space-y-2">
                    {historyMatches.map(m => (
                      <div key={m.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                        <div>
                          <span className="font-body font-semibold text-sm">{m.hospital_name}</span>
                          <div className="font-body text-xs text-muted-foreground">{m.hospital_city}</div>
                        </div>
                        <Badge className={`font-body text-xs border-0 ${statusClass(m.status)}`}>{statusLabel(m.status)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ MY TAB — HOSPITAL ════ */}
          {tab === "my" && isHospital && (
            <div className="space-y-6">

              {hospDash && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: "⚠️", label: "Active Requests", value: hospDash.stats.active_requests, color: "text-blood" },
                    { icon: "⏳", label: "Pending Matches", value: hospDash.stats.pending_matches, color: "text-platelet" },
                    { icon: "✅", label: "Accepted / Scheduled", value: acceptedCount, color: "text-secondary" },
                    {
                      icon: "🍼", label: "Total Received", value: hospDash.stats.total_received_ml >= 1000
                        ? `${(hospDash.stats.total_received_ml / 1000).toFixed(1)}L`
                        : `${hospDash.stats.total_received_ml}ml`, color: "text-milk"
                    },
                  ].map(({ icon, label, value, color }) => (
                    <div key={label} className="rounded-xl bg-card border border-border p-4 text-center shadow-card">
                      <div className="text-2xl mb-1">{icon}</div>
                      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
                      <div className="font-body text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Active Requests */}
                <div className="rounded-2xl border-2 border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg font-bold flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-milk" /> Active Requests
                    </h3>
                    <Button onClick={() => setShowShortage(true)}
                      className="bg-milk text-foreground font-body font-bold rounded-xl h-9 text-xs px-4">
                      <Plus className="w-4 h-4 mr-1" /> New Request
                    </Button>
                  </div>
                  {hospLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-milk" /></div>
                  ) : (
                    // BUG FIX 1: r.status now exists on HospRequest type, so this
                    // filter correctly shows posted requests instead of always returning []
                    (hospDash?.active_requests || []).filter(r => ["open", "donor_contacted"].includes(r.status)).length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground font-body text-sm">
                        No active requests. Post a shortage above.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(hospDash?.active_requests || []).filter(r => ["open", "donor_contacted"].includes(r.status)).map(req => (
                          <div key={req.id} className="rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-body font-bold text-sm">{req.volume_ml}ml/day</span>
                                {req.infant_ref && req.infant_ref !== "General NICU" && (
                                  <span className="text-muted-foreground font-normal text-xs"> · {req.infant_ref}</span>
                                )}
                              </div>
                              <Badge className={`text-[10px] border-0 font-body uppercase ${urgencyClass(req.urgency)}`}>{req.urgency}</Badge>
                            </div>
                            <Button onClick={() => handleFindMatches(req)}
                              disabled={findingId === req.id}
                              variant="outline" size="sm"
                              className="w-full font-body text-xs rounded-lg border-milk/30 text-milk hover:bg-milk/10">
                              {findingId === req.id
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Finding...</>
                                : <><Search className="w-3.5 h-3.5 mr-1" /> Find Matches</>}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                {/* Matched Donors */}
                {/* BUG FIX 2: Direct donors (like Kara) now appear here because:
                    a) backend auto-creates milk_matches row on logDonation
                    b) dashboard endpoint also pulls milk_donations directly */}
                <div className="rounded-2xl border-2 border-border bg-card p-6">
                  <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-milk" /> Matched Donors
                    <Badge variant="outline" className="font-body text-[10px] border-milk/30 text-milk ml-auto">Coordination Flow</Badge>
                  </h3>
                  {(() => {
                    const all = hospDash?.matched_donors || [];
                    if (all.length === 0) return (
                      <div className="p-8 text-center text-muted-foreground font-body text-sm border-2 border-dashed rounded-xl">
                        No matched donors yet. Click "Find Matches" on an active request.
                      </div>
                    );
                    return (
                      <div className="space-y-3">
                        {all.map(d => (
                          <div key={d.id} className="rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="font-body font-bold text-sm">{d.donor_name}</div>
                                <div className="font-body text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {d.city}
                                  {d.quantity_ml && <span>· {d.quantity_ml}ml/day</span>}
                                </div>
                              </div>
                              <Badge className={`text-[10px] border-0 font-body ${statusClass(d.status)}`}>
                                {statusLabel(d.status)}
                              </Badge>
                            </div>
                            {d.status === "pending" && (
                              <p className="font-body text-xs text-muted-foreground italic mt-1">⏳ Waiting for donor to respond…</p>
                            )}
                            {d.status === "accepted" && (
                              <Button onClick={() => handleMatchStatus(d.id, "pickup_scheduled")}
                                variant="outline" size="sm"
                                className="w-full font-body text-xs rounded-lg border-secondary/30 text-secondary hover:bg-secondary/10 h-8">
                                <Clock className="w-3.5 h-3.5 mr-1" /> Schedule Pickup
                              </Button>
                            )}
                            {d.status === "pickup_scheduled" && (
                              <Button onClick={() => handleMatchStatus(d.id, "collected")}
                                className="w-full bg-secondary text-white font-body font-bold rounded-xl h-9 text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Collected
                              </Button>
                            )}
                            {/* BUG FIX 4 & 5: pass actual quantity as volMl AND requestId */}
                            {d.status === "collected" && (
                              <Button
                                onClick={() => {
                                  if (!d.donor_id || d.donor_id.trim() === "") {
                                    toast.error("Donor ID missing — cannot log donation.");
                                    return;
                                  }
                                  const vol = d.quantity_ml || 200;
                                  setLogModal({
                                    matchId: d.id,
                                    donorId: d.donor_id,
                                    hospId: userId,
                                    requestId: d.request_id,   // BUG FIX 5: closes the shortage
                                    volMl: vol,            // BUG FIX 4: real quantity
                                  });
                                  setLogForm(f => ({ ...f, volMl: vol }));
                                }}
                                className="w-full bg-blood text-white font-body font-bold rounded-xl h-9 text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Log & Complete
                              </Button>
                            )}
                            {d.status === "delivered" && (
                              <p className="font-body text-xs text-secondary font-semibold mt-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Donation completed ✓
                              </p>
                            )}
                            {d.status === "declined" && (
                              <p className="font-body text-xs text-blood italic mt-1">Donor declined. Try finding other matches.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Recent Donations Received */}
              <div className="rounded-2xl border-2 border-border bg-card p-6">
                <h3 className="font-display text-lg font-bold mb-4">Recent Donations Received</h3>
                {(hospDash?.donation_history || []).length === 0 ? (
                  <p className="font-body text-sm text-muted-foreground">No donation history yet. Complete a donation above.</p>
                ) : (
                  <div className="space-y-2">
                    {hospDash!.donation_history.map((d, i) => (
                      <div key={i} className="rounded-xl border border-border p-3 flex items-center justify-between">
                        <div>
                          <span className="font-body text-sm font-semibold">{d.donor_name}</span>
                          <div className="font-body text-xs text-muted-foreground">{d.volume_ml}ml · {d.date}</div>
                        </div>
                        <Badge className="bg-green-100 text-green-700 border-0 font-body text-xs">{d.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ MILK BANK TAB ════ */}
          {tab === "bank" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold flex items-center gap-3">
                  🏦 Milk Bank Registry
                  <Badge className="bg-milk/20 text-milk border-0 font-body text-[10px] rounded-full uppercase font-black">Milk Passport™</Badge>
                </h3>
                <div className="flex items-center gap-2">
                  {isDonor && (
                    <Badge className="bg-milk/20 text-milk border-0 font-body text-[10px]">Your donations only</Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={fetchShared} className="font-body text-xs">
                    <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-xl border border-border flex-wrap">
                <span className="font-body text-xs font-bold text-foreground uppercase tracking-widest mr-2">COLD CHAIN:</span>
                {["Collected", "Pasteurized", "Available", "In Transit", "Delivered"].map((step, i, arr) => (
                  <span key={step} className="flex items-center gap-1 font-body text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">{step}</span>
                    {i < arr.length - 1 && <span>→</span>}
                  </span>
                ))}
              </div>

              <div className="rounded-2xl border-2 border-border/50 bg-card overflow-hidden shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        {["Passport ID", "Donor", "Pasteurized", "Expiry", "Qty", "Cold Chain Status", "Track"].map(h => (
                          <th key={h} className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-6 py-4 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sharedLoading ? (
                        <tr><td colSpan={7} className="text-center py-10 font-body text-xs text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-milk" />Loading registry...
                        </td></tr>
                      ) : visibleMilkBank.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-10 font-body text-xs text-muted-foreground italic">
                          {isDonor
                            ? "No donations logged yet. Complete a donation via the hospital to see your records here."
                            : "No milk shipments currently in processing. Complete a donation via \"Log & Complete\" to populate this registry."}
                        </td></tr>
                      ) : visibleMilkBank.map(row => (
                        <tr key={row.id} className="border-b border-border last:border-0 hover:bg-milk/5 transition-colors group">
                          <td className="font-body text-xs font-bold px-6 py-4 text-milk">{row.id}</td>
                          <td className="font-body text-sm font-semibold px-6 py-4">{row.from}</td>
                          <td className="font-body text-xs px-6 py-4 text-muted-foreground">{row.pasteurized}</td>
                          <td className="font-body text-xs px-6 py-4 text-muted-foreground">{row.expiry}</td>
                          <td className="font-body text-sm font-black px-6 py-4">{row.qty}</td>
                          <td className="px-6 py-4">
                            <Badge className={`text-[9px] uppercase px-2 py-0.5 border-0 font-bold ${row.status === "Available" ? "bg-secondary/15 text-secondary" :
                              row.status === "Low Stock" ? "bg-amber-100 text-amber-700" :
                                row.status === "Pasteurized" ? "bg-purple-100 text-purple-700" :
                                  row.status === "Collected" ? "bg-blue-100 text-blue-700" :
                                    row.status === "Delivered" ? "bg-green-100 text-green-700" :
                                      row.status === "In Transit" ? "bg-indigo-100 text-indigo-700" :
                                        row.status === "Expired" ? "bg-red-100 text-red-700" :
                                          "bg-muted text-muted-foreground"
                              }`}>{row.status}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            <button onClick={() => handleViewQR(row)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted group-hover:bg-milk/20 group-hover:text-milk transition-all">
                              <QrCode className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-50 border border-orange-200">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">🛡️</div>
                <p className="font-body text-[11px] text-orange-900 leading-tight">
                  Each sample is tracked via <strong>Milk Passport™</strong> with full cold-chain visibility. Rigorous pasteurization protocols following WHO guidelines.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />

      {/* ── Post Shortage Modal ── */}
      <AnimatePresence>
        {showShortage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-card rounded-3xl border-2 border-blood/20 shadow-2xl overflow-hidden">
              <div className="bg-blood p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-display text-xl font-bold">Post Milk Shortage</h3>
                  <p className="text-white/70 text-xs font-body">Broadcast emergency NICU need</p>
                </div>
                <button onClick={() => setShowShortage(false)} className="p-2 hover:bg-white/20 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handlePostShortage} className="p-6 space-y-4">
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Infant Identifier (Optional)</Label>
                  <Input placeholder="e.g. Baby of Anjali or Bed #4" className="rounded-xl mt-1"
                    value={shortageForm.infantName} onChange={e => setShortageForm(p => ({ ...p, infantName: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Daily ML Needed</Label>
                  <Input type="number" min={50} step={50} required className="rounded-xl mt-1"
                    value={shortageForm.qtyMl} onChange={e => setShortageForm(p => ({ ...p, qtyMl: parseInt(e.target.value) || 50 }))} />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Urgency</Label>
                  <Select value={shortageForm.urgency} onValueChange={v => setShortageForm(p => ({ ...p, urgency: v }))}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={postingShortage} className="w-full bg-blood text-white font-bold h-12 rounded-xl">
                  {postingShortage ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Alert"}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Find Matches Modal ── */}
      <AnimatePresence>
        {matchResults !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg bg-card rounded-3xl border-2 border-milk/20 shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-bold">Matched Donors</h3>
                <button onClick={() => { setMatchResults(null); setMatchingReqId(null); }}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              {matchResults.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">👥</div>
                  <p className="font-body font-semibold text-muted-foreground">No matching donors found.</p>
                  <p className="font-body text-xs text-muted-foreground mt-1">Try expanding your search radius.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchResults.map(m => (
                    <div key={m.milk_donor_id} className="rounded-xl border border-border p-4 flex items-center justify-between">
                      <div>
                        <div className="font-body font-bold text-sm flex items-center gap-1.5">
                          {m.name} {m.verified && <Sparkles size={12} className="text-amber-500" />}
                        </div>
                        <div className="font-body text-xs text-muted-foreground">
                          {m.city} · {m.quantity_ml}ml/day · {m.distance} · Score: {m.match_score}
                        </div>
                      </div>
                      <Button onClick={() => handleCreateMatch(m)} size="sm"
                        className="bg-milk text-foreground font-body font-bold rounded-lg h-8 text-xs px-3">
                        Match
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={() => { setMatchResults(null); setMatchingReqId(null); }}
                className="w-full mt-4 bg-milk text-foreground font-body font-bold rounded-xl h-10">
                Close
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Log & Complete Modal ── */}
      <AnimatePresence>
        {logModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-card rounded-3xl border-2 border-secondary/20 shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-bold">Log & Complete Donation</h3>
                <button onClick={() => setLogModal(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>

              {/* BUG FIX 3: Warn visibly if requestId is missing */}
              {!logModal.requestId && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="font-body text-xs text-amber-800">
                    No request ID linked — the Critical Shortage entry may not close automatically after logging.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                    Volume Received (ml) — pre-filled from request
                  </Label>
                  <Input type="number" step="50" min="50" className="rounded-xl mt-1 h-11"
                    value={logForm.volMl} onChange={e => setLogForm(p => ({ ...p, volMl: parseInt(e.target.value) || 50 }))} />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Collection Date</Label>
                  <Input type="date" className="rounded-xl mt-1 h-11"
                    value={logForm.date} onChange={e => setLogForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                  <input type="checkbox" id="pasteurized" className="w-4 h-4"
                    checked={logForm.pasteurized} onChange={e => setLogForm(p => ({ ...p, pasteurized: e.target.checked }))} />
                  <label htmlFor="pasteurized" className="font-body text-sm font-semibold cursor-pointer">Pasteurization complete</label>
                </div>
              </div>
              <p className="font-body text-xs text-muted-foreground mt-3 italic">
                Creates a Milk Passport™ record, updates the Milk Bank, and closes this request from the shortage board.
              </p>
              <Button onClick={handleLogComplete} disabled={logLoading}
                className="w-full mt-4 bg-blood text-white font-body font-bold rounded-xl h-11">
                {logLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Log & Complete"}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Cold Chain Tracking Modal ── */}
      <AnimatePresence>
        {trackingRow && (() => {
          const STEPS = ["Collected", "Pasteurized", "Available", "In Transit", "Delivered"];
          const curIdx = STEPS.findIndex(s => s.toLowerCase() === (trackingRow.status || "").toLowerCase());
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-md bg-card rounded-3xl border-2 border-milk/20 shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-milk to-amber-400 p-6 flex justify-between items-center">
                  <div>
                    <h3 className="font-display text-xl font-bold">Cold Chain Tracking</h3>
                    <p className="text-foreground/70 text-xs font-body">Milk Passport™ {trackingRow.id}</p>
                  </div>
                  <button onClick={() => setTrackingRow(null)} className="p-2 hover:bg-white/20 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div>
                      <div className="font-body text-sm font-semibold">{trackingRow.from}</div>
                      <div className="font-body text-xs text-muted-foreground">{trackingRow.pasteurized} · {trackingRow.expiry}</div>
                    </div>
                    <span className="font-display text-xl font-black text-milk">{trackingRow.qty}</span>
                  </div>
                  <div className="space-y-2">
                    {STEPS.map((step, idx) => {
                      const done = curIdx >= 0 && idx <= curIdx;
                      const current = curIdx >= 0 && idx === curIdx;
                      return (
                        <div key={step} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${current ? "bg-milk text-foreground ring-2 ring-milk/40 ring-offset-2" :
                            done ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"
                            }`}>
                            {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="font-bold text-xs">{idx + 1}</span>}
                          </div>
                          <div className={`flex-1 py-2 px-3 rounded-lg ${current ? "bg-milk/10 border border-milk/30" : ""}`}>
                            <span className={`font-body text-sm ${current ? "font-bold" : done ? "text-secondary font-semibold" : "text-muted-foreground"}`}>
                              {step}
                            </span>
                            {current && <span className="ml-2 font-body text-[10px] bg-milk text-foreground px-2 py-0.5 rounded-full font-bold uppercase">Current</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200 mt-2">
                    <div className="text-lg">🛡️</div>
                    <p className="font-body text-[10px] text-orange-900 leading-tight">
                      Verified via <strong>Milk Passport™</strong>. Pasteurization and health screening confirmed per WHO guidelines.
                    </p>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <Button onClick={() => setTrackingRow(null)} className="w-full bg-milk text-foreground font-body font-bold rounded-xl h-10">
                    Close
                  </Button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
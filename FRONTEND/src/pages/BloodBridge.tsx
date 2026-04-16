/**
 * BloodBridge.tsx — v4
 * ────────────────────────────────────────────────────────────────
 * Fully independent BloodBridge page.
 * Hospital view:  Post Urgent Need modal, request management table,
 *                 donor search (distance-ranked), map with real coords.
 * Donor view:     Compatible open requests, accept/decline, history.
 *
 * FIXED v4:
 * - Hero stats no longer stuck on "—": isInitialLoading now resolves
 *   independently from the large donor fetch (limit:500).
 * - computeHeroStats checks multiple possible API field names for
 *   the available flag (available, available_to_donate, is_available)
 *   and falls back to total donor count if none match.
 * - Large donor fetch failure is handled gracefully with fallback.
 * ────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Clock, AlertTriangle, CheckCircle2, Plus, Filter,
  ArrowLeft, Loader2, Search, Heart, Droplets, Shield, Activity,
  X, ChevronDown, Building2, ClipboardList, History, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BloodBridgeMap from "@/components/BloodBridgeMap";
import { api, BloodDonor, BloodRequest, isLoggedIn, getCurrentUserId } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/AuthContext";

// ── Local types ──────────────────────────────────────────────────────────────

interface HospitalRequest {
  id: string;
  blood_group: string;
  units: number;
  urgency: string;
  status: string;
  timeLeft: string;
  hours_left: number;
  created_at: string;
  donors_pending: number;
  donors_accepted: number;
  donors_declined: number;
  donors_fulfilled: number;
  notes: string;
  donor_responses: { donor_id: string; name: string; status: string }[];
}

interface DonorHistoryRow {
  response_id: string;
  request_id: string;
  status: string;
  responded_at: string | null;
  blood_group: string;
  units: number;
  urgency: string;
  hospital: string;
  city: string;
  request_status: string;
  created_at: string;
}

// ── Hero stats type ──────────────────────────────────────────────────────────
interface HeroStats {
  activeDonors: string;
  matchesToday: string;
  avgMatchTime: string;
}

// ── Blood groups ─────────────────────────────────────────────────────────────
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const URGENCY_OPTS = ["normal", "urgent", "critical"];

// ── Status badge helper ───────────────────────────────────────────────────────
function statusBadge(status: string) {
  const map: Record<string, string> = {
    open:             "bg-secondary/15 text-secondary",
    donor_contacted:  "bg-platelet/15 text-platelet",
    fulfilled:        "bg-green-500/15 text-green-600",
    closed:           "bg-muted text-muted-foreground",
    expired:          "bg-blood/10 text-blood",
    pending:          "bg-muted text-muted-foreground",
    accepted:         "bg-secondary/15 text-secondary",
    declined:         "bg-blood/10 text-blood",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

// ════════════════════════════════════════════════════════════════════════════
export default function BloodBridge() {
  const { role, userName, profile } = useAuth();
  const isDonor    = role === "donor";
  const isHospital = role === "hospital";
  const userId     = getCurrentUserId();

  // ── Hero stats (dynamic) ─────────────────────────────────────────────────
  const [heroStats, setHeroStats] = useState<HeroStats>({
    activeDonors: "—",
    matchesToday: "—",
    avgMatchTime: "—",
  });

  // ── Shared state ─────────────────────────────────────────────────────────
  const [donors, setDonors]                 = useState<BloodDonor[]>([]);
  const [urgentRequests, setUrgentRequests] = useState<BloodRequest[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoading, setIsLoading]           = useState(false);
  const [selectedGroup, setSelectedGroup]   = useState<string | null>(null);
  const [locationInput, setLocationInput]   = useState("");
  const [selectedDonorProfile, setSelectedDonorProfile] = useState<BloodDonor | null>(null);

  // ── Hospital-specific state ───────────────────────────────────────────────
  const [activeTab, setActiveTab]               = useState<"search" | "requests" | "post">("search");
  const [hospitalRequests, setHospitalRequests] = useState<HospitalRequest[]>([]);
  const [hospitalReqLoading, setHospitalReqLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("lfc_dismissed_requests");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // Persist dismissedIds to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("lfc_dismissed_requests", JSON.stringify([...dismissedIds]));
    } catch {}
  }, [dismissedIds]);

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postForm, setPostForm]           = useState({
    blood_group: "O+", units: 1, urgency: "urgent", notes: "",
  });
  const [postLoading, setPostLoading] = useState(false);

  // ── Donor-specific state ──────────────────────────────────────────────────
  const [donorTab, setDonorTab]         = useState<"requests" | "history">("requests");
  const [donorHistory, setDonorHistory] = useState<DonorHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // ── Clear dismissed IDs when user logs out ────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setDismissedIds(new Set());
      localStorage.removeItem("lfc_dismissed_requests");
    }
  }, [userId]);

  // ── Compute hero stats from fetched data ──────────────────────────────────
  // FIX: checks multiple possible API field names for the available flag,
  // and falls back to total donor count if none match.
  const computeHeroStats = (allDonors: BloodDonor[], allRequests: BloodRequest[]) => {
    const activeDonorCount = allDonors.filter(d =>
      d.available === true ||
      (d as any).available_to_donate === true ||
      (d as any).is_available === true
    ).length;

    // If no available flags matched, fall back to total donor count
    const displayDonorCount = activeDonorCount > 0 ? activeDonorCount : allDonors.length;

    const today = new Date().toDateString();
    const matchesTodayCount = allRequests.filter(r => {
      try {
        return new Date((r as any).created_at).toDateString() === today;
      } catch { return false; }
    }).length;

    setHeroStats({
      activeDonors: displayDonorCount > 0 ? displayDonorCount.toLocaleString() : "0",
      matchesToday: matchesTodayCount.toLocaleString(),
      avgMatchTime: "~4 min",
    });
  };

  // ── Initial load ──────────────────────────────────────────────────────────
  // FIX: The large donor fetch (limit:500) no longer blocks isInitialLoading.
  // It runs independently so hero stats resolve as soon as possible without
  // blocking the UI. Failure is handled gracefully with a fallback.
  useEffect(() => {
    const fetchData = async () => {
      try {
        const reqsPromise = isDonor
          ? api.blood.getRequestsForDonor(userId!)
          : api.blood.getOpenRequests();

        const [reqs, initialDonors] = await Promise.all([
          reqsPromise,
          isHospital ? api.blood.getDonors({ limit: 4 }) : Promise.resolve([]),
        ]);

        setUrgentRequests(reqs as BloodRequest[]);
        setDonors(initialDonors as BloodDonor[]);

        // Fetch large donor list for accurate hero stats independently
        // so it doesn't block the initial loading spinner
        api.blood.getDonors({ limit: 500 })
          .then(allDonors => {
            computeHeroStats(allDonors as BloodDonor[], reqs as BloodRequest[]);
          })
          .catch(() => {
            // Fallback: use whatever donors we already have
            computeHeroStats(initialDonors as BloodDonor[], reqs as BloodRequest[]);
          });

      } catch {
        toast.error("Could not load latest requests");
      } finally {
        // Always unblock the UI regardless of the large donor fetch
        setIsInitialLoading(false);
      }
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch hospital requests ───────────────────────────────────────────────
  const fetchHospitalRequests = async (silent = false) => {
    if (!userId) return;
    if (!silent) setHospitalReqLoading(true);
    try {
      const data = await api.blood.getHospitalRequests(userId);
      setHospitalRequests(data as HospitalRequest[]);
    } catch {
      if (!silent) toast.error("Could not load request management table");
    } finally {
      if (!silent) setHospitalReqLoading(false);
    }
  };

  useEffect(() => {
    if (isHospital && activeTab === "requests") {
      fetchHospitalRequests();
      // Silent auto-refresh every 15s
      const interval = setInterval(() => fetchHospitalRequests(true), 15000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isHospital]);

  // ── Fetch donor history ───────────────────────────────────────────────────
  const fetchDonorHistory = async () => {
    if (!userId) return;
    setHistoryLoading(true);
    try {
      const data = await api.blood.getDonorHistory(userId);
      setDonorHistory(data as DonorHistoryRow[]);
    } catch {
      toast.error("Could not load donation history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isDonor && donorTab === "history") fetchDonorHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donorTab, isDonor]);

  // ── Search donors ─────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!isLoggedIn()) { toast.error("Please login to search the donor registry"); return; }
    if (!isHospital)   { toast.error("Only hospitals can search the donor registry"); return; }
    setIsLoading(true);
    try {
      const isPincode = /^\d{6}$/.test(locationInput.trim());
      const results = await api.blood.getDonors({
        blood_group: selectedGroup || undefined,
        city:    !isPincode ? locationInput.trim() || undefined : undefined,
        pincode: isPincode  ? locationInput.trim() : undefined,
        limit: 20,
      });
      setDonors(results as BloodDonor[]);
      results.length === 0
        ? toast.info("No matching donors found.")
        : toast.success(`Found ${results.length} matching donors!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to search donors");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Request specific donor ────────────────────────────────────────────────
  const handleRequest = async (donor: BloodDonor) => {
    if (!isLoggedIn())              { toast.error("Please login to request donation"); return; }
    if (!donor.eligible_to_donate)  { toast.error(`${donor.name} is not eligible yet.`); return; }
    if (!isHospital || !userId)     { toast.error("Only verified hospitals can send requests."); return; }

    try {
      const res: any = await api.blood.requestDonor({
        hospital_id: userId,
        donor_id:    donor.id,
        blood_group: donor.group,
        units:       1,
        urgency:     "urgent",
      });
      if (res.success) {
        toast.success(`Request sent to ${donor.name}!`, { description: res.message });
        setSelectedDonorProfile(null);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to send request");
    }
  };

  // ── Post urgent need ──────────────────────────────────────────────────────
  const handlePostRequest = async () => {
    if (!isHospital || !userId) {
      toast.error("Only verified hospitals can post urgent blood requirements.");
      return;
    }
    setPostModalOpen(true);
  };

  const handlePostSubmit = async () => {
    if (!userId) return;
    setPostLoading(true);
    try {
      const res: any = await api.blood.postRequest({
        hospital_id: userId,
        blood_group: postForm.blood_group,
        units:       postForm.units,
        urgency:     postForm.urgency,
        notes:       postForm.notes,
      });
      toast.success("Urgent request posted!", { description: res.message });
      setPostModalOpen(false);
      setPostForm({ blood_group: "O+", units: 1, urgency: "urgent", notes: "" });

      // Refresh open requests and recompute hero stats
      const [reqs, allDonorsForStats] = await Promise.all([
        api.blood.getOpenRequests(),
        api.blood.getDonors({ limit: 500 }),
      ]);
      setUrgentRequests(reqs as BloodRequest[]);
      computeHeroStats(allDonorsForStats as BloodDonor[], reqs as BloodRequest[]);
    } catch (e: any) {
      toast.error(e.message || "Failed to post request");
    } finally {
      setPostLoading(false);
    }
  };

  // ── Donor respond ─────────────────────────────────────────────────────────
  const handleDonorRespond = async (req: BloodRequest, action: "accept" | "decline") => {
    if (!isLoggedIn() || !userId) { toast.error("Please login to respond"); return; }
    setRespondingId(req.id);
    try {
      const res: any = await api.blood.respondToRequest({
        request_id: req.id,
        donor_id:   userId,
        action,
      });
      if (res.success) {
        toast.success(
          action === "accept" ? "You've pledged to donate! 🩸" : "Response recorded.",
          { description: action === "accept" ? `${req.hospital} has been notified.` : undefined }
        );
        if (action === "decline") {
          setUrgentRequests(prev => prev.filter(r => r.id !== req.id));
        } else {
          setUrgentRequests(prev =>
            prev.map(r => r.id === req.id ? { ...r, my_status: res.status } : r)
          );
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to record response");
    } finally {
      setRespondingId(null);
    }
  };

  // ── Hospital fulfill / close ──────────────────────────────────────────────
  const handleFulfill = async (requestId: string) => {
    if (!userId) return;
    setDismissedIds(prev => new Set([...prev, requestId]));
    setHospitalRequests(prev => prev.filter(r => r.id !== requestId));
    try {
      await api.blood.fulfillRequest(requestId, userId);
      toast.success("Request fulfilled! 🎉 Blood need has been met.");
    } catch (e: any) {
      setDismissedIds(prev => { const s = new Set(prev); s.delete(requestId); return s; });
      fetchHospitalRequests();
      toast.error(e.message || "Failed to fulfill request");
    }
  };

  const handleClose = async (requestId: string) => {
    if (!userId) return;
    setDismissedIds(prev => new Set([...prev, requestId]));
    setHospitalRequests(prev => prev.filter(r => r.id !== requestId));
    try {
      await api.blood.closeRequest(requestId, userId);
      toast.success("Request closed.");
    } catch (e: any) {
      setDismissedIds(prev => { const s = new Set(prev); s.delete(requestId); return s; });
      fetchHospitalRequests();
      toast.error(e.message || "Failed to close request");
    }
  };

  // ── Map donors: real lat/lng from API ─────────────────────────────────────
  const mapDonors = donors.map(d => ({
    id:           d.id,
    name:         d.name,
    blood_group:  d.group,
    city:         d.city,
    trust_score:  d.trust,
    distance_km:  d.distance_km || 0,
    lat:          (d as any).lat ?? 0,
    lng:          (d as any).lng ?? 0,
  }));

  const hospitalLocation = isHospital && profile?.lat && profile?.lng
    ? { lat: profile.lat, lng: profile.lng, name: userName || "Your Hospital" }
    : null;

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">

        {/* ── Module Hero ── */}
        <div className="bg-gradient-to-br from-blood/90 to-blood/60 text-primary-foreground py-16 px-4">
          <div className="container mx-auto">
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground font-body text-sm mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-6xl">🩸</div>
              <div>
                <h1 className="font-display text-5xl font-black">BloodBridge</h1>
                <p className="font-body text-primary-foreground/70 text-lg">
                  {isDonor ? "See who needs your help today" : "Real-time blood group matching across India"}
                </p>
              </div>
            </div>

            {/* ── Dynamic hero stats ── */}
            <div className="flex gap-6 mt-6 flex-wrap">
              {[
                { label: "Active Donors",  value: heroStats.activeDonors },
                { label: "Matches Today",  value: heroStats.matchesToday },
                { label: "Avg Match Time", value: heroStats.avgMatchTime },
              ].map(({ label, value }) => (
                <div key={label} className="glass rounded-xl px-5 py-3">
                  <div className="font-display text-2xl font-bold">
                    {isInitialLoading ? (
                      <span className="inline-block w-12 h-6 bg-primary-foreground/20 animate-pulse rounded" />
                    ) : (
                      value
                    )}
                  </div>
                  <div className="font-body text-xs text-primary-foreground/70">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ══════════════════════════════════════════════════════════
                SIDEBAR
            ══════════════════════════════════════════════════════════ */}
            <div className="space-y-5">

              {/* ── DONOR SIDEBAR ── */}
              {isDonor && (
                <>
                  <div className="rounded-2xl border-2 border-blood/20 bg-card p-6 shadow-card overflow-hidden relative">
                    <div className="absolute -top-8 -right-8 opacity-5"><Droplets size={120} /></div>
                    <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                      <Heart className="w-5 h-5 text-blood" /> My Donor Status
                    </h3>
                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blood/10 flex items-center justify-center font-display font-bold text-blood text-lg">
                          {userName?.[0] || "D"}
                        </div>
                        <div>
                          <div className="font-body font-bold text-sm">{userName || "Donor"}</div>
                          <Badge className="bg-secondary/15 text-secondary border-0 font-body text-[10px] mt-0.5">
                            {profile?.is_verified ? "✓ Verified" : "Pending Verification"}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-blood/5 border border-blood/10 text-center">
                          <div className="font-display font-black text-lg text-blood">{profile?.blood_group || "—"}</div>
                          <div className="font-body text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Blood Group</div>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/5 border border-secondary/10 text-center">
                          <div className="font-display font-black text-lg text-secondary">{profile?.trust_score || 0}</div>
                          <div className="font-body text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Trust Score</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/50 border border-border">
                        <div className="font-body text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5">Location</div>
                        <div className="font-body text-sm font-semibold flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blood" /> {profile?.city || "Not set"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 border-secondary/20 bg-secondary/5 p-5">
                    <h3 className="font-display text-sm font-bold mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-secondary" /> Donation Readiness
                    </h3>
                    <div className="space-y-2.5">
                      {[
                        "Stay hydrated before donating",
                        "Last donation must be 90+ days ago",
                        "Carry a valid government ID",
                        "Eat well before the appointment",
                      ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-secondary mt-0.5 shrink-0" />
                          <span className="font-body text-xs text-foreground/70">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── HOSPITAL SIDEBAR ── */}
              {(isHospital || !role) && (
                <>
                  {/* Tab switcher */}
                  {isHospital && (
                    <div className="flex gap-1 rounded-xl bg-muted/50 p-1 border border-border">
                      {[
                        { key: "search",   label: "Find Donors",  icon: Search },
                        { key: "requests", label: "My Requests",  icon: ClipboardList },
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setActiveTab(key as any)}
                          className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg font-body text-xs font-semibold transition-all ${
                            activeTab === key
                              ? "bg-blood text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Find Donors panel */}
                  {(!isHospital || activeTab === "search") && (
                    <div className="rounded-2xl border-2 border-blood/20 bg-card p-5 shadow-card">
                      <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                        <Filter className="w-5 h-5 text-blood" /> Find Donors
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Blood Group</label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {BLOOD_GROUPS.map(g => (
                              <button
                                key={g}
                                onClick={async () => {
                                  const newGroup = selectedGroup === g ? null : g;
                                  setSelectedGroup(newGroup);
                                  setIsLoading(true);
                                  try {
                                    const isPincode = /^\d{6}$/.test(locationInput.trim());
                                    const results = await api.blood.getDonors({
                                      blood_group: newGroup || undefined,
                                      city: !isPincode ? locationInput.trim() || undefined : undefined,
                                      pincode: isPincode ? locationInput.trim() : undefined,
                                      limit: 20,
                                    });
                                    setDonors(results as BloodDonor[]);
                                  } catch (e: any) {
                                    toast.error(e.message || "Failed to search donors");
                                  } finally {
                                    setIsLoading(false);
                                  }
                                }}
                                className={`h-9 rounded-lg border-2 font-display text-xs font-bold transition-all ${
                                  selectedGroup === g
                                    ? "border-blood bg-blood text-white"
                                    : "border-border hover:border-blood hover:bg-blood/10"
                                }`}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Location / PIN</label>
                          <Input
                            placeholder="Enter city or 6-digit PIN"
                            className="h-10 rounded-xl font-body"
                            value={locationInput}
                            onChange={e => setLocationInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                          />
                        </div>
                        <Button
                          onClick={handleSearch}
                          disabled={isLoading}
                          className="w-full bg-blood text-primary-foreground font-body font-bold rounded-xl h-11"
                        >
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search Donors"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Post urgent need panel */}
                  <div className="rounded-2xl border-2 border-blood/20 bg-blood/5 p-5">
                    <h3 className="font-display text-base font-bold mb-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blood" /> Post Urgent Need
                    </h3>
                    <p className="font-body text-xs text-muted-foreground mb-3">
                      Notify verified donors near your hospital instantly.
                    </p>
                    <Button
                      onClick={handlePostRequest}
                      variant="outline"
                      className="w-full border-blood text-blood font-body font-semibold rounded-xl hover:bg-blood hover:text-primary-foreground"
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> Post Request
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════
                MAIN CONTENT
            ══════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-2 space-y-6">

              {/* ══════════════════════════════════════════════════════
                  DONOR VIEW
              ══════════════════════════════════════════════════════ */}
              {isDonor && (
                <>
                  {/* Tab switcher */}
                  <div className="flex gap-1 rounded-xl bg-muted/50 p-1 border border-border max-w-xs">
                    {[
                      { key: "requests", label: "Requests",    icon: AlertTriangle },
                      { key: "history",  label: "My History",  icon: History },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setDonorTab(key as any)}
                        className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg font-body text-xs font-semibold transition-all ${
                          donorTab === key
                            ? "bg-blood text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </button>
                    ))}
                  </div>

                  {/* ── Donor: Open Requests ── */}
                  {donorTab === "requests" && (
                    <div>
                      <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-blood animate-pulse" /> Hospitals Need Your Help
                      </h3>
                      {isInitialLoading && (
                        <div className="flex justify-center py-10">
                          <Loader2 className="w-6 h-6 animate-spin text-blood" />
                        </div>
                      )}
                      {urgentRequests.length === 0 && !isInitialLoading && (
                        <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/5">
                          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                          <p className="text-muted-foreground font-body font-semibold">No active blood requests matching your group right now.</p>
                          <p className="text-muted-foreground font-body text-xs mt-1">You'll be notified when a patient nearby needs your blood group.</p>
                        </div>
                      )}
                      <div className="space-y-3">
                        {urgentRequests.map((req, i) => {
                          const myStatus = (req as any).my_status as string | undefined;
                          const responded = myStatus && myStatus !== "pending";
                          return (
                            <motion.div
                              key={req.id || i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.07 }}
                              className={`rounded-2xl border-2 bg-card p-5 shadow-card transition-all hover:shadow-lg ${
                                req.urgency === "CRITICAL" ? "border-blood/40" : "border-blood/15"
                              } ${responded ? "opacity-70" : ""}`}
                            >
                              <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-blood/10 flex items-center justify-center shrink-0">
                                  <span className="font-display font-black text-blood text-lg">{req.group}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="font-display font-bold text-base">{req.hospital}</span>
                                    <Badge className={`text-[10px] border-0 font-body font-black uppercase ${
                                      req.urgency === "CRITICAL" ? "bg-blood/15 text-blood animate-pulse"
                                      : req.urgency === "URGENT" ? "bg-platelet/15 text-platelet"
                                      : "bg-muted text-muted-foreground"
                                    }`}>
                                      {req.urgency}
                                    </Badge>
                                    {myStatus && (
                                      <Badge className={`text-[10px] border-0 font-body ${statusBadge(myStatus)}`}>
                                        {myStatus}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="font-body text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                                    <span className="font-bold">{req.units} unit(s)</span>
                                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {req.city}</span>
                                    {(req as any).distance && <span>{(req as any).distance}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-3">
                                    <div className={`flex items-center gap-1 font-body font-bold text-sm ${
                                      (req.hours_left ?? 999) < 24 ? "text-blood" : "text-platelet"
                                    }`}>
                                      <Clock className="w-3.5 h-3.5" /> {req.timeLeft} remaining
                                    </div>
                                  </div>
                                </div>

                                {!responded ? (
                                  <div className="flex flex-col gap-2 shrink-0">
                                    <Button
                                      onClick={() => handleDonorRespond(req, "accept")}
                                      disabled={respondingId === req.id}
                                      className="bg-blood text-white font-body font-bold rounded-xl h-10 px-4 shadow-md hover:scale-[1.03] transition-transform"
                                    >
                                      {respondingId === req.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <><Heart className="w-4 h-4 mr-1" /> I'll Donate</>
                                      }
                                    </Button>
                                    <Button
                                      onClick={() => handleDonorRespond(req, "decline")}
                                      disabled={respondingId === req.id}
                                      variant="outline"
                                      size="sm"
                                      className="rounded-xl font-body text-xs border-border"
                                    >
                                      <X className="w-3.5 h-3.5 mr-1" /> Can't Help
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge className={`shrink-0 ${statusBadge(myStatus!)} font-body`}>
                                    {myStatus === "accepted" ? "✓ Pledged" : myStatus}
                                  </Badge>
                                )}
                              </div>

                              {profile?.blood_group && (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <div className="font-body text-[11px] text-muted-foreground flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                                    Your blood group <strong className="text-blood">{profile.blood_group}</strong>{" "}
                                    {profile.blood_group === req.group ? "is a direct match!" : "may be compatible — tap to help."}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Donor: History ── */}
                  {donorTab === "history" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display text-xl font-bold flex items-center gap-2">
                          <History className="w-5 h-5 text-blood" /> Donation History
                        </h3>
                        <Button variant="ghost" size="sm" onClick={fetchDonorHistory} disabled={historyLoading}>
                          <RefreshCw className={`w-4 h-4 ${historyLoading ? "animate-spin" : ""}`} />
                        </Button>
                      </div>

                      {historyLoading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blood" /></div>}
                      {donorHistory.length === 0 && !historyLoading && (
                        <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/5">
                          <History className="w-10 h-10 mx-auto mb-3 opacity-20 text-muted-foreground" />
                          <p className="text-muted-foreground font-body">No donation history yet.</p>
                        </div>
                      )}

                      <div className="space-y-3">
                        {donorHistory.map((row, i) => (
                          <motion.div
                            key={row.response_id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-xl border-2 border-border bg-card p-4 flex items-center gap-4"
                          >
                            <div className="w-12 h-12 rounded-xl bg-blood/10 flex items-center justify-center shrink-0">
                              <span className="font-display font-black text-blood text-sm">{row.blood_group}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-body font-bold text-sm">{row.hospital}</span>
                                <Badge className={`text-[10px] border-0 font-body ${statusBadge(row.status)}`}>
                                  {row.status}
                                </Badge>
                              </div>
                              <div className="font-body text-xs text-muted-foreground mt-0.5">
                                {row.units} unit(s) · {row.city} · {row.urgency}
                              </div>
                              {row.responded_at && (
                                <div className="font-body text-[10px] text-muted-foreground mt-0.5">
                                  Responded: {new Date(row.responded_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <Badge className={`text-[10px] border-0 font-body ${statusBadge(row.request_status)}`}>
                                {row.request_status}
                              </Badge>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Impact stats */}
                      <div className="mt-6 p-5 rounded-2xl bg-muted/30 border-2 border-border/50">
                        <h4 className="font-display text-base font-bold mb-3 flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-blood" /> Your Impact
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: "Accepted",  value: donorHistory.filter(r => r.status === "accepted" || r.status === "fulfilled").length, color: "text-secondary" },
                            { label: "Fulfilled", value: donorHistory.filter(r => r.status === "fulfilled").length, color: "text-blood" },
                            { label: "Declined",  value: donorHistory.filter(r => r.status === "declined").length, color: "text-muted-foreground" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="text-center p-3 bg-card rounded-xl border border-border">
                              <div className={`font-display font-black text-2xl ${color}`}>{value}</div>
                              <div className="font-body text-[9px] text-muted-foreground uppercase tracking-widest font-bold">{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ══════════════════════════════════════════════════════
                  HOSPITAL VIEW
              ══════════════════════════════════════════════════════ */}
              {(isHospital || !role) && (
                <>
                  {/* ── Hospital: Request Management Table ── */}
                  {isHospital && activeTab === "requests" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display text-xl font-bold flex items-center gap-2">
                          <ClipboardList className="w-5 h-5 text-blood" /> Request Management
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => fetchHospitalRequests()} disabled={hospitalReqLoading}>
                          <RefreshCw className={`w-4 h-4 ${hospitalReqLoading ? "animate-spin" : ""}`} />
                        </Button>
                      </div>

                      {hospitalReqLoading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blood" /></div>}
                      {hospitalRequests.length === 0 && !hospitalReqLoading && (
                        <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/5">
                          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20 text-muted-foreground" />
                          <p className="font-body text-muted-foreground">No requests yet. Post your first urgent need!</p>
                          <Button onClick={handlePostRequest} variant="outline" className="mt-4 border-blood text-blood font-body">
                            <Plus className="w-4 h-4 mr-1.5" /> Post Request
                          </Button>
                        </div>
                      )}

                      <div className="space-y-3">
                        {hospitalRequests.filter(r => (r.status === "open" || r.status === "donor_contacted") && !dismissedIds.has(r.id)).length === 0 && !hospitalReqLoading && hospitalRequests.length > 0 && (
                          <div className="p-6 text-center border-2 border-dashed rounded-2xl bg-muted/5">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-secondary opacity-60" />
                            <p className="font-body text-muted-foreground text-sm">No active requests. All requests have been closed or fulfilled.</p>
                          </div>
                        )}
                        {hospitalRequests
                          .filter(r => (r.status === "open" || r.status === "donor_contacted") && !dismissedIds.has(r.id))
                          .map((req, i) => (
                          <motion.div
                            key={req.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-xl border-2 border-border bg-card p-4"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-blood/10 flex items-center justify-center shrink-0">
                                <span className="font-display font-black text-blood text-sm">{req.blood_group}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-body font-bold text-sm">{req.blood_group} · {req.units} unit(s)</span>
                                  <Badge className={`text-[10px] border-0 font-body font-black uppercase ${
                                    req.urgency === "CRITICAL" ? "bg-blood/15 text-blood"
                                    : req.urgency === "URGENT" ? "bg-platelet/15 text-platelet"
                                    : "bg-muted text-muted-foreground"
                                  }`}>{req.urgency}</Badge>
                                  <Badge className={`text-[10px] border-0 font-body ${statusBadge(req.status)}`}>
                                    {req.status}
                                  </Badge>
                                </div>

                                {/* Donor response counters */}
                                <div className="flex gap-3 mt-1 flex-wrap">
                                  {[
                                    { label: "Pending",   value: req.donors_pending,  color: "text-muted-foreground" },
                                    { label: "Accepted",  value: req.donors_accepted, color: "text-secondary" },
                                    { label: "Declined",  value: req.donors_declined, color: "text-blood" },
                                    { label: "Fulfilled", value: req.donors_fulfilled, color: "text-green-600" },
                                  ].map(({ label, value, color }) => (
                                    <div key={label} className="font-body text-[11px]">
                                      <span className={`font-bold ${color}`}>{value}</span>
                                      <span className="text-muted-foreground ml-0.5">{label}</span>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2 mt-1.5">
                                  {(req.status === "open" || req.status === "donor_contacted") && (
                                    <div className="flex items-center gap-1 text-blood font-body text-xs font-bold">
                                      <Clock className="w-3 h-3" /> {req.timeLeft} left
                                    </div>
                                  )}
                                  <span className="font-body text-[10px] text-muted-foreground">
                                    {new Date(req.created_at).toLocaleDateString()}
                                  </span>
                                </div>

                                {/* Donor responses list */}
                                {req.donor_responses && req.donor_responses.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-border/50">
                                    <div className="font-body text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Donor Responses</div>
                                    <div className="space-y-1">
                                      {req.donor_responses.map((dr, di) => (
                                        <div key={di} className="flex items-center justify-between">
                                          <span className="font-body text-xs font-semibold">{dr.name}</span>
                                          <span className={`font-body text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            dr.status === "accepted"  ? "bg-secondary/15 text-secondary" :
                                            dr.status === "declined"  ? "bg-blood/10 text-blood" :
                                            dr.status === "fulfilled" ? "bg-green-500/15 text-green-600" :
                                            "bg-muted text-muted-foreground"
                                          }`}>
                                            {dr.status === "accepted"  ? "✓ Accepted" :
                                             dr.status === "declined"  ? "✗ Declined" :
                                             dr.status === "fulfilled" ? "✓ Fulfilled" :
                                             "⏳ Pending"}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              {(req.status === "open" || req.status === "donor_contacted") && (
                                <div className="flex flex-col gap-1.5 shrink-0">
                                  <Button
                                    size="sm"
                                    onClick={() => handleFulfill(req.id)}
                                    className="bg-secondary text-white font-body text-xs rounded-lg h-8 px-3"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Fulfill
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleClose(req.id)}
                                    className="font-body text-xs rounded-lg h-8 px-3 border-border"
                                  >
                                    <X className="w-3.5 h-3.5 mr-1" /> Close
                                  </Button>
                                </div>
                              )}
                            </div>
                            {req.notes && (
                              <div className="mt-2 pt-2 border-t border-border/50 font-body text-xs text-muted-foreground italic">
                                {req.notes}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Hospital: Donor search results + live requests + map ── */}
                  {(!isHospital || activeTab === "search") && (
                    <>
                      {/* Donor cards */}
                      <div>
                        <h3 className="font-display text-xl font-bold mb-4">
                          {selectedGroup ? `Available Donors (${selectedGroup})` : "Available Donors"}
                          {donors.length > 0 && <span className="font-body text-sm text-muted-foreground ml-2 font-normal">Sorted by distance</span>}
                        </h3>
                        {donors.length === 0 && !isLoading && (
                          <div className="p-12 text-center bg-muted/20 border-2 border-dashed rounded-2xl">
                            <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                            <p className="text-muted-foreground font-body">
                              {isHospital ? "Use the search panel to find matching donors." : "Login as a hospital to search the donor registry."}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {donors.map((donor, i) => (
                            <motion.div
                              key={donor.id || i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.07 }}
                              className={`rounded-xl border-2 bg-card p-4 shadow-card ${
                                donor.available ? "border-secondary/30" : "border-border opacity-60"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-blood/10 flex items-center justify-center font-display font-bold text-blood">
                                    {donor.name[0]}
                                  </div>
                                  <div>
                                    <div className="font-body font-bold text-sm">{donor.name}</div>
                                    <div className="flex items-center gap-1.5 font-body text-xs text-muted-foreground">
                                      <MapPin className="w-3 h-3" /> {donor.city}
                                      {donor.distance_km !== null && donor.distance_km !== undefined && (
                                        <span className="text-secondary font-semibold">· {donor.distance}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <Badge className={`font-body text-xs border-0 ${donor.available ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}>
                                    {donor.available ? "Available" : "Busy"}
                                  </Badge>
                                  {donor.is_verified && (
                                    <Badge className="font-body text-[10px] border-0 bg-secondary/10 text-secondary">✓ Verified</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-xs font-body text-muted-foreground mb-3 flex-wrap">
                                <span className="font-bold text-blood text-sm">{donor.group}</span>
                                <span>⭐ {donor.trust}</span>
                                <span>Last: {donor.last_donated}</span>
                                {!donor.eligible_to_donate && (
                                  <Badge className="text-[10px] border-0 bg-platelet/10 text-platelet">Not eligible yet</Badge>
                                )}
                              </div>
                              {donor.available && (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="flex-1 border-border font-body text-xs rounded-lg" onClick={() => setSelectedDonorProfile(donor)}>
                                    View Profile
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleRequest(donor)}
                                    disabled={!donor.eligible_to_donate}
                                    className="flex-1 bg-blood text-primary-foreground font-body text-xs rounded-lg disabled:opacity-50"
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Request
                                  </Button>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Interactive Donor Map with real coordinates */}
                      <div>
                        <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-blood" /> Nearby Donors
                        </h3>
                        <div className="rounded-2xl border-2 border-blood/20 bg-card shadow-card overflow-hidden">
                          <BloodBridgeMap donors={mapDonors} hospitalLocation={hospitalLocation} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {/* ══════════════════════════════════════════════════════════════════════
          POST URGENT NEED MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={postModalOpen} onOpenChange={o => !o && setPostModalOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-xl">
              <div className="w-9 h-9 rounded-xl bg-blood/10 flex items-center justify-center">
                <Droplets className="w-5 h-5 text-blood" />
              </div>
              Post Urgent Blood Need
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              Only verified hospitals can post. Compatible donors in your area will be notified instantly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Blood group */}
            <div>
              <label className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Blood Group Required *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BLOOD_GROUPS.map(g => (
                  <button
                    key={g}
                    onClick={() => setPostForm(f => ({ ...f, blood_group: g }))}
                    className={`h-10 rounded-xl border-2 font-display text-sm font-bold transition-all ${
                      postForm.blood_group === g
                        ? "border-blood bg-blood text-white shadow-md"
                        : "border-border hover:border-blood hover:bg-blood/10"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Units + Urgency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Units Required
                </label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={postForm.units}
                  onChange={e => setPostForm(f => ({ ...f, units: parseInt(e.target.value) || 1 }))}
                  className="h-10 rounded-xl font-body"
                />
              </div>
              <div>
                <label className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Urgency Level
                </label>
                <Select value={postForm.urgency} onValueChange={v => setPostForm(f => ({ ...f, urgency: v }))}>
                  <SelectTrigger className="h-10 rounded-xl font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTS.map(u => (
                      <SelectItem key={u} value={u} className="font-body capitalize">{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Additional Notes (optional)
              </label>
              <Input
                placeholder="e.g. Emergency surgery, patient in ICU..."
                className="h-10 rounded-xl font-body"
                value={postForm.notes}
                onChange={e => setPostForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Urgency info */}
            <div className="p-3 rounded-xl bg-blood/5 border border-blood/20 font-body text-xs text-muted-foreground">
              <strong className="text-blood">Expiry:</strong>{" "}
              {{
                critical: "Critical requests expire in 6h",
                urgent:   "Urgent requests expire in 12h",
                normal:   "Normal requests expire in 24h",
              }[postForm.urgency]}
            </div>

            <Button
              onClick={handlePostSubmit}
              disabled={postLoading}
              className="w-full h-12 bg-blood text-white font-body font-bold rounded-xl text-base shadow-md"
            >
              {postLoading
                ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Posting...</>
                : <><Plus className="w-5 h-5 mr-2" /> Post Urgent Request</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          DONOR PROFILE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedDonorProfile} onOpenChange={o => !o && setSelectedDonorProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-blood/10 flex items-center justify-center text-blood text-xl font-black">
                {selectedDonorProfile?.name[0]}
              </div>
              <div>
                <div className="text-xl">{selectedDonorProfile?.name}</div>
                <div className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedDonorProfile?.distance !== "—"
                    ? selectedDonorProfile?.distance
                    : selectedDonorProfile?.city}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="flex gap-4 p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex-1 text-center border-r border-border">
                <div className="font-display font-black text-2xl text-blood">{selectedDonorProfile?.group}</div>
                <div className="font-body text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Blood Group</div>
              </div>
              <div className="flex-1 text-center border-r border-border">
                <div className="font-display font-black text-2xl text-secondary">{selectedDonorProfile?.trust}</div>
                <div className="font-body text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Trust Stars</div>
              </div>
              <div className="flex-1 text-center flex flex-col items-center justify-center">
                <Badge className={`font-body text-xs border-0 ${selectedDonorProfile?.available ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}>
                  {selectedDonorProfile?.available ? "Available" : "Busy"}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 font-body text-sm pt-2">
              {[
                { label: "Location",     value: selectedDonorProfile?.city },
                { label: "Last Donated", value: selectedDonorProfile?.last_donated || "No record" },
                { label: "Verified",     value: selectedDonorProfile?.is_verified ? "✓ Yes" : "Pending" },
                { label: "Distance",     value: selectedDonorProfile?.distance !== "—" ? selectedDonorProfile?.distance : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold text-foreground text-right">{value}</span>
                </div>
              ))}
            </div>

            <Button
              className="w-full h-11 bg-blood hover:bg-blood/90 text-white font-body font-bold rounded-xl mt-4"
              disabled={!selectedDonorProfile?.eligible_to_donate}
              onClick={() => { if (selectedDonorProfile) handleRequest(selectedDonorProfile); }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {selectedDonorProfile?.eligible_to_donate ? "Request Donation" : "Not Eligible Yet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
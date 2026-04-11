import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, MapPin, Heart, QrCode,
  ChevronRight, Check, Loader2, RefreshCw, LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, OrganViability, OrganRecipient, getCurrentUserId, isLoggedIn } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ── Fallback data used when the API has no rows yet ──────────────────────────
const FALLBACK_ORGANS: OrganViability[] = [
  { name: "Heart", emoji: "❤️", window: "4–6 hrs", viabilityHrs: 5, color: "text-blood" },
  { name: "Liver", emoji: "🫀", window: "12–24 hrs", viabilityHrs: 18, color: "text-thal" },
  { name: "Kidney", emoji: "🫘", window: "24–36 hrs", viabilityHrs: 30, color: "text-organ" },
  { name: "Lungs", emoji: "🫁", window: "4–6 hrs", viabilityHrs: 5, color: "text-marrow" },
  { name: "Pancreas", emoji: "🔬", window: "12–18 hrs", viabilityHrs: 15, color: "text-platelet" },
  { name: "Cornea", emoji: "👁️", window: "5–7 days", viabilityHrs: 144, color: "text-milk" },
];

// ── Viability timer bar ──────────────────────────────────────────────────────
function ViabilityTimer({ name, hrs, maxHrs }: { name: string; hrs: number; maxHrs: number }) {
  const pct = (hrs / maxHrs) * 100;
  const remaining = Math.round(hrs * 0.6);
  return (
    <div className="p-3 rounded-xl border border-border bg-card">
      <div className="flex justify-between items-center mb-2">
        <span className="font-body text-xs font-semibold text-foreground">{name}</span>
        <span className={`font-display font-bold text-sm ${hrs < 8 ? "text-blood animate-pulse" : "text-organ"}`}>
          {remaining}h left
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${hrs < 8 ? "bg-blood" : "bg-organ"}`}
          style={{ width: `${100 - pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function LastGift() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Data state ──
  const [organs, setOrgans] = useState<OrganViability[]>([]);
  const [recipients, setRecipients] = useState<OrganRecipient[]>([]);
  const [stats, setStats] = useState({ pledged: "—", organTypes: "—", livesSaved: "—" });

  // ── Loading / error ──
  const [loadingOrgans, setLoadingOrgans] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [errorOrgans, setErrorOrgans] = useState(false);
  const [errorRecipients, setErrorRecipients] = useState(false);

  // ── Pledge flow ──
  const [selectedOrgans, setSelectedOrgans] = useState<string[]>([]);
  const [pledging, setPledging] = useState(false);
  const [pledgeResult, setPledgeResult] = useState<{ id: string; organs: string[] } | null>(null);

  // ── Matching ──
  const [matchingId, setMatchingId] = useState<string | null>(null);

  // ── Fetch organ viability data ──
  const fetchOrgans = async () => {
    setLoadingOrgans(true);
    setErrorOrgans(false);
    try {
      const data = await api.organ.getViability();
      setOrgans(data && data.length > 0 ? data : FALLBACK_ORGANS);
    } catch {
      setOrgans(FALLBACK_ORGANS);
      setErrorOrgans(true);
    } finally {
      setLoadingOrgans(false);
    }
  };

  // ── Fetch recipients ──
  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    setErrorRecipients(false);
    try {
      const data = await api.organ.getRecipients();
      setRecipients(data || []);
    } catch {
      setRecipients([]);
      setErrorRecipients(true);
    } finally {
      setLoadingRecipients(false);
    }
  };

  // ── Fetch platform stats ──
  const fetchStats = async () => {
    try {
      const s = await api.stats();
      setStats({
        pledged: s.active_donors_online > 999
          ? `${(s.active_donors_online / 1000).toFixed(1)}K`
          : String(s.active_donors_online || 0),
        organTypes: "6",
        livesSaved: s.lives_impacted?.toLocaleString() || "0",
      });
    } catch {
      setStats({ pledged: "—", organTypes: "6", livesSaved: "—" });
    }
  };

  useEffect(() => {
    fetchOrgans();
    fetchRecipients();
    fetchStats();
  }, []);

  // ── Toggle organ selection ──
  const toggleOrgan = (organName: string) => {
    setSelectedOrgans((prev) =>
      prev.includes(organName)
        ? prev.filter((o) => o !== organName)
        : [...prev, organName]
    );
  };

  // ── Pledge card button ──
  const handlePledge = async () => {
    if (!isLoggedIn()) {
      toast({
        title: "Login Required",
        description: "Please log in to pledge your organs.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    if (selectedOrgans.length === 0) {
      toast({
        title: "No Organs Selected",
        description: "Please select at least one organ to pledge.",
        variant: "destructive",
      });
      return;
    }

    setPledging(true);
    try {
      const result = await api.organ.createPledge({
        donor_id: getCurrentUserId(),
        organs: selectedOrgans,
        family_consent: false,
      });
      setPledgeResult({ id: result.pledge_id_short, organs: result.organs_pledged });
      toast({
        title: "🎉 Pledge Saved!",
        description: `Pledge ID: ${result.pledge_id_short} — ${result.organs_pledged.join(", ")}`,
      });
      setSelectedOrgans([]);
    } catch (err: any) {
      toast({
        title: "Pledge Failed",
        description: err.message || "Could not save your pledge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPledging(false);
    }
  };

  // ── Match button on recipients ──
  const handleMatch = async (recipient: OrganRecipient) => {
    if (!isLoggedIn()) {
      toast({
        title: "Login Required",
        description: "Please log in to match with a recipient.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setMatchingId(recipient.id);
    // Simulate a brief processing moment
    await new Promise((r) => setTimeout(r, 600));
    toast({
      title: `Matching with ${recipient.name}`,
      description: `Organ: ${recipient.organ} · Blood: ${recipient.blood} · Hospital: ${recipient.hospital}. A coordinator will contact you shortly.`,
    });
    setMatchingId(null);
  };

  // ── Skeleton rows helper ──
  const CardSkeleton = () => (
    <div className="rounded-xl border-2 border-border bg-card p-4 space-y-3">
      <Skeleton className="h-8 w-8 rounded-lg mx-auto" />
      <Skeleton className="h-4 w-20 mx-auto" />
      <Skeleton className="h-3 w-16 mx-auto" />
    </div>
  );

  const RecipientSkeleton = () => (
    <div className="rounded-xl border-2 border-organ/20 bg-card p-4 flex items-center gap-4">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-8 w-16 rounded-lg" />
    </div>
  );

  // ── The organs to display (for pledge card + viability grid) ──
  const displayOrgans = organs.length > 0 ? organs : FALLBACK_ORGANS;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        {/* ── Hero banner ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-organ/90 to-cyan-700/60 text-primary-foreground py-16 px-4">
          <div className="container mx-auto">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground font-body text-sm mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-6xl">🫁</div>
              <div>
                <h1 className="font-display text-5xl font-black">LastGift</h1>
                <p className="font-body text-primary-foreground/70 text-lg">
                  Dignified organ donation. Lasting impact.
                </p>
              </div>
            </div>
            <div className="flex gap-6 mt-6 flex-wrap">
              {[
                { label: "Pledged Donors", value: stats.pledged },
                { label: "Organ Types", value: stats.organTypes },
                { label: "Lives Saved", value: stats.livesSaved },
              ].map(({ label, value }) => (
                <div key={label} className="glass rounded-xl px-5 py-3">
                  <div className="font-display text-2xl font-bold">{value}</div>
                  <div className="font-body text-xs text-primary-foreground/70">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main content ────────────────────────────────────────────── */}
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
            <div className="space-y-5">
              {/* Pledge card */}
              <div className="rounded-2xl border-2 border-organ/20 bg-card p-5 shadow-card">
                <h3 className="font-display text-base font-bold mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-organ fill-current" /> Pledge Your Organs
                </h3>
                <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                  Select which organs you wish to donate. Family OTP consent required.
                  Receive a digital pledge card + QR code.
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {displayOrgans.map((o) => {
                    const isSelected = selectedOrgans.includes(o.name);
                    return (
                      <button
                        key={o.name}
                        onClick={() => toggleOrgan(o.name)}
                        className={`rounded-xl p-2.5 text-center border-2 transition-all relative ${isSelected
                            ? "border-organ bg-organ/15 ring-2 ring-organ/30"
                            : "border-border hover:border-organ hover:bg-organ/10"
                          }`}
                      >
                        <div className="text-xl">{o.emoji}</div>
                        <div className="font-body text-xs font-semibold text-foreground mt-0.5">
                          {o.name}
                        </div>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-organ rounded-full flex items-center justify-center"
                            >
                              <Check className="w-3 h-3 text-white" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    );
                  })}
                </div>

                {selectedOrgans.length > 0 && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="font-body text-xs text-organ font-semibold mb-3"
                  >
                    Selected: {selectedOrgans.join(", ")}
                  </motion.p>
                )}

                <Button
                  className="w-full bg-organ text-primary-foreground font-body font-bold rounded-xl"
                  onClick={handlePledge}
                  disabled={pledging}
                >
                  {pledging ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4 mr-2" />
                  )}
                  {pledging ? "Saving Pledge..." : "Get Digital Pledge Card"}
                </Button>

                {/* Pledge result */}
                <AnimatePresence>
                  {pledgeResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 p-3 rounded-xl border border-organ/30 bg-organ/5"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <QrCode className="w-4 h-4 text-organ" />
                        <span className="font-display font-bold text-sm text-organ">
                          Pledge ID: {pledgeResult.id}
                        </span>
                      </div>
                      <p className="font-body text-xs text-muted-foreground">
                        Organs: {pledgeResult.organs.join(", ")}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Viability timers */}
              <div className="rounded-2xl border-2 border-organ/20 bg-card p-5 shadow-card">
                <h3 className="font-display text-base font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-organ" /> Viability Windows
                </h3>
                <div className="space-y-2">
                  <ViabilityTimer name="Heart (active case)" hrs={4} maxHrs={6} />
                  <ViabilityTimer name="Kidney (active case)" hrs={24} maxHrs={36} />
                  <ViabilityTimer name="Liver (active case)" hrs={12} maxHrs={24} />
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN (2-col span) ───────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Organ viability grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl font-bold">Organ Viability Windows</h3>
                  {errorOrgans && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchOrgans}
                      className="text-organ font-body text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Retry
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {loadingOrgans
                    ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
                    : displayOrgans.map((o, i) => (
                      <motion.div
                        key={o.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.07 }}
                        className="rounded-xl border-2 border-border bg-card p-4 text-center shadow-card hover:border-organ/30 transition-all cursor-pointer"
                        onClick={() => toggleOrgan(o.name)}
                      >
                        <div className="text-3xl mb-2">{o.emoji}</div>
                        <div className="font-display font-bold text-foreground text-base">
                          {o.name}
                        </div>
                        <div className={`font-body text-sm font-bold mt-1 ${o.color}`}>
                          {o.window}
                        </div>
                        <div className="font-body text-xs text-muted-foreground">viability</div>
                        {selectedOrgans.includes(o.name) && (
                          <Badge className="mt-2 bg-organ/15 text-organ border-0 font-body text-xs">
                            <Check className="w-3 h-3 mr-1" /> Selected
                          </Badge>
                        )}
                      </motion.div>
                    ))}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl font-bold">Recipient Ranking (Active)</h3>
                  {errorRecipients && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchRecipients}
                      className="text-organ font-body text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Retry
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {loadingRecipients ? (
                    Array.from({ length: 3 }).map((_, i) => <RecipientSkeleton key={i} />)
                  ) : recipients.length === 0 ? (
                    <div className="text-center py-10 rounded-xl border-2 border-dashed border-border">
                      <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                      <p className="font-body text-sm text-muted-foreground">
                        No active recipients at this time.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 text-organ font-body"
                        onClick={fetchRecipients}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                      </Button>
                    </div>
                  ) : (
                    recipients.map((r, i) => (
                      <motion.div
                        key={r.id || i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="rounded-xl border-2 border-organ/20 bg-card p-4 flex items-center gap-4"
                      >
                        <div className="w-10 h-10 rounded-xl bg-organ/10 flex items-center justify-center font-display font-black text-organ text-sm">
                          #{r.rank || i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-body font-bold text-sm">{r.name}</span>
                            <Badge className="bg-organ/15 text-organ border-0 font-body text-xs">
                              {r.organ}
                            </Badge>
                            <span className="font-body text-xs text-muted-foreground">
                              {r.blood}
                            </span>
                          </div>
                          <div className="font-body text-xs text-muted-foreground mt-0.5">
                            <MapPin className="w-3 h-3 inline" /> {r.hospital}
                            {r.hospital_city ? `, ${r.hospital_city}` : ""}
                            {r.wait && r.wait !== "—" ? ` · Wait: ${r.wait}` : ""}
                            {r.distance_km != null ? ` · ${r.distance_km} km` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display font-black text-organ text-xl">
                            {r.urgency}
                          </div>
                          <div className="font-body text-xs text-muted-foreground">urgency</div>
                        </div>
                        <Button
                          size="sm"
                          className="bg-organ text-primary-foreground font-body font-semibold rounded-lg"
                          onClick={() => handleMatch(r)}
                          disabled={matchingId === r.id}
                        >
                          {matchingId === r.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              Match <ChevronRight className="w-3 h-3 ml-1" />
                            </>
                          )}
                        </Button>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

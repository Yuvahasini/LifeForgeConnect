import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, Dna, ChevronRight, Shield, CheckCircle2, Loader2, Search, X, Fingerprint, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, MarrowMatch as MarrowMatchType, isLoggedIn, getCurrentUserId } from "@/lib/api";
import { toast } from "sonner";

// Mock HLA for demonstration
const DEFAULT_HLA = ["A*02:01", "B*07:02", "C*07:01", "DRB1*15:01", "DQB1*06:02"];

interface ContactSuccess {
  donor_name: string;
  donor_city: string;
  next_steps: string[];
}

function MatchMeter({ pct }: { pct: number }) {
  return (
    <div className="relative w-16 h-16 mx-auto">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.9" fill="none"
          stroke="hsl(var(--marrow))" strokeWidth="3"
          strokeDasharray={`${pct} ${100 - pct}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display font-black text-xs text-marrow">{pct}%</span>
      </div>
    </div>
  );
}

export default function MarrowMatch() {
  const [patientName, setPatientName] = useState("");
  const [urgency, setUrgency] = useState("Routine");
  const [matches, setMatches] = useState<MarrowMatchType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);

  // Donor registration form
  const [hlaInput, setHlaInput] = useState({
    hlaA: "A*02:01",
    hlaB: "B*07:02",
    hlaC: "C*07:01",
    hlaDR: "DRB1*15:01"
  });

  const [contactSuccess, setContactSuccess] = useState<ContactSuccess | null>(null);

  const loadDonors = async () => {
    try {
      const data = await api.marrow.getDonors();
      if (Array.isArray(data)) {
        const formatted = data.map((d: any) => ({
          id: d.id.slice(0, 4).toUpperCase(),
          donor_id: d.id,
          matchPct: 0,
          confidence: "Registry",
          hlaA: d.hla_type?.[0] || "—",
          hlaB: d.hla_type?.[1] || "—",
          location: d.city || "Not set",
          age: 28,
          donated: 0,
          status: d.trust_score >= 70 ? "Willing" : "Considering"
        }));
        setMatches(formatted.slice(0, 5));
      }
    } catch (error) {
      console.error("Failed to load donors", error);
    }
  };

  useEffect(() => {
    loadDonors();
  }, []);

  const handleFindMatches = async () => {
    if (!isLoggedIn()) {
      toast.error("Please login to perform HLA matching");
      return;
    }
    if (!isUploaded && !patientName) {
      toast.error("Please enter a patient name or upload a report first");
      return;
    }
    setIsLoading(true);
    try {
      // simulate network lag for the "Scanning" effect if report was uploaded
      if (isUploaded) await new Promise(r => setTimeout(r, 1500));

      const result = await api.marrow.findMatches(DEFAULT_HLA, patientName || "P-SEARCH");
      setMatches(result.matches);
      toast.success(`Analysis complete: Found ${result.total_found} HLA matches!`, {
        icon: <Activity className="text-marrow w-4 h-4" />
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to find matches");
    } finally {
      setIsLoading(false);
    }
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isLoggedIn()) {
      toast.error("Please login to upload medical reports");
      return;
    }
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      // Simulate file scanning
      setTimeout(() => {
        setIsUploading(false);
        setIsUploaded(true);
        toast.success("HLA Report scanned. Precision sequence extracted.");
      }, 2000);
    }
  };

  const handleRegisterDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn()) {
      toast.error("Please login as a donor first");
      return;
    }
    setIsRegistering(true);
    try {
      const donorId = getCurrentUserId();
      const hlaArray = Object.values(hlaInput).filter(v => v.length > 0);
      await api.marrow.registerHla(donorId, hlaArray);
      toast.success("Marrow profile active! You are now searchable in the registry.");
      setShowRegModal(false);
      loadDonors(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message || "Failed to register");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleContact = (id: string) => {
    if (!isLoggedIn()) {
      toast.error("Please login to initiate contact with donors");
      return;
    }

    const match = matches.find(m => m.id === id);
    if (!match) return;

    setContactSuccess({
      donor_name: `Donor #${match.id}`,
      donor_city: match.location,
      next_steps: [
        "Medical officer reviews sequencing rapport",
        "Confirmation swab requested from donor",
        "Logistics coordination for health screening"
      ]
    });

    toast.success(`Match Request Sent!`, {
      description: `Donor #${id} has been notified. Coordination for confirmation testing will begin shortly.`,
      icon: <CheckCircle2 className="text-secondary w-4 h-4" />
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-16">
        <div className="bg-gradient-to-br from-marrow/90 to-teal-800/60 text-primary-foreground py-16 px-4">
          <div className="container mx-auto">
            <Link to="/" className="inline-flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground font-body text-sm mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Bridge
            </Link>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-6xl animate-pulse">🧬</div>
              <div>
                <h1 className="font-display text-5xl font-black">MarrowMatch</h1>
                <p className="font-body text-primary-foreground/70 text-lg">94% precision matching for bone marrow registries</p>
              </div>
            </div>
            <div className="flex gap-6 mt-6 flex-wrap">
              {[
                { label: "India Registry", value: "48,204+" },
                { label: "Live Matches", value: matches.filter(m => m.matchPct > 0).length || "12" },
                { label: "Successful Saves", value: "1,847" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 border border-white/20">
                  <div className="font-display text-2xl font-bold">{value}</div>
                  <div className="font-body text-[10px] text-primary-foreground/70 uppercase tracking-widest">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              {/* Find Match Card */}
              <div className="rounded-3xl border-2 border-marrow/20 bg-card p-6 shadow-card overflow-hidden relative">
                <div className="absolute -top-10 -right-10 opacity-5 rotate-12">
                  <Fingerprint size={160} />
                </div>
                <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                  <Search className="w-5 h-5 text-marrow" /> Find Genetic Match
                </h3>
                <div className="space-y-4 relative z-10">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal Patient Ref</Label>
                    <Input
                      placeholder="e.g. PAT-9021"
                      className="h-11 rounded-xl font-body border-marrow/10"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">HLA Report (Typing)</Label>
                    <div className="relative group">
                      <input
                        type="file"
                        id="hla-upload"
                        className="hidden"
                        onChange={onFileUpload}
                        disabled={isUploading}
                      />
                      <label
                        htmlFor="hla-upload"
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer ${isUploaded ? "border-secondary bg-secondary/5" : "border-marrow/20 hover:border-marrow/50 hover:bg-marrow/5"}`}
                      >
                        {isUploading ? (
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 text-marrow animate-spin mx-auto mb-2" />
                            <p className="font-body text-xs font-bold text-marrow">SCANNED FOR SEQUENCES...</p>
                          </div>
                        ) : isUploaded ? (
                          <div className="text-center">
                            <CheckCircle2 className="w-8 h-8 text-secondary mx-auto mb-2" />
                            <p className="font-body text-xs font-bold text-secondary uppercase">Report Scanned</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="w-8 h-8 text-marrow/50 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                            <p className="font-body text-xs text-muted-foreground font-semibold">Drop HLA report here</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Urgency</Label>
                    <div className="flex bg-muted p-1 rounded-xl gap-1">
                      {["Critical", "Routine"].map((u) => (
                        <button
                          key={u}
                          onClick={() => setUrgency(u)}
                          className={`flex-1 py-2 rounded-lg font-body text-[10px] font-bold uppercase transition-all ${urgency === u ? "bg-white text-marrow shadow-sm" : "text-muted-foreground hover:bg-white/50"}`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleFindMatches}
                    disabled={isLoading || isUploading}
                    className="w-full bg-marrow text-white font-body font-bold rounded-xl h-12 shadow-lg shadow-marrow/20 hover:scale-[1.02] transition-transform mt-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Initiate Match Search"}
                  </Button>
                </div>
              </div>

              {/* Pledge Card */}
              <div className="rounded-3xl border-2 border-marrow/20 bg-marrow/5 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-marrow/5 rounded-full -mr-16 -mt-16" />
                <h3 className="font-display text-lg font-bold mb-2">Be a Donor</h3>
                <p className="font-body text-xs text-muted-foreground mb-4 leading-relaxed">Most matches are found within the same ethnic group. Your registry could save a life today.</p>
                <div className="space-y-2.5 mb-6">
                  {["Age 18–50", "Healthy History", "Willing to travel"].map(req => (
                    <div key={req} className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-marrow" />
                      <span className="font-body text-[11px] font-semibold text-foreground/70 tracking-tight">{req}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => setShowRegModal(true)}
                  className="w-full bg-white text-marrow border-2 border-marrow font-body font-bold rounded-xl h-11 hover:bg-marrow hover:text-white transition-all shadow-sm"
                >
                  Register HLA Profile
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-display text-xl font-bold flex items-center gap-2">
                  {isLoading ? "Analyzing Compatible Donors..." : matches.length > 0 && matches[0].matchPct > 0 ? "Potential Genetic Matches" : "Recent Registry Members"}
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin text-marrow" />}
                </h3>
                {matches.length > 0 && matches[0].matchPct > 0 && (
                  <Badge className="bg-marrow/10 text-marrow border-0 font-body text-[10px] px-3 h-6 flex gap-1">
                    <Activity size={12} /> SORTED BY HLA CONFIDENCE
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                {matches.length === 0 && !isLoading && (
                  <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
                    <Dna className="w-12 h-12 text-muted mx-auto mb-3 opacity-30" />
                    <p className="text-muted-foreground font-body font-bold text-sm">No specific matches found in your area.</p>
                    <p className="text-muted-foreground font-body text-xs mt-1">Upload a typing report for precision search.</p>
                  </div>
                )}

                {matches.map((m, i) => (
                  <motion.div
                    key={m.id + i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`rounded-3xl border-2 p-6 shadow-sm transition-all group ${m.matchPct >= 90 ? "border-secondary/30 bg-secondary/5" : "border-marrow/10 bg-card hover:border-marrow/30"}`}
                  >
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <MatchMeter pct={m.matchPct} />

                      <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap mb-4">
                          <span className="font-display font-black text-lg text-foreground tracking-tighter uppercase">Donor #{m.id}</span>
                          <Badge className={`text-[10px] font-black tracking-widest uppercase border-0 h-5 px-2 ${m.matchPct >= 90 ? "bg-secondary text-white" : "bg-marrow/20 text-marrow"}`}>
                            {m.confidence}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] font-bold border-2 h-5 px-2 ${m.status === "Willing" ? "border-secondary/20 text-secondary" : "border-muted text-muted-foreground"}`}>
                            {m.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                          {[
                            { label: "HLA-A Sequence", val: m.hlaA },
                            { label: "HLA-B Sequence", val: m.hlaB },
                            { label: "Donor Region", val: m.location },
                            { label: "Matches Found", val: m.donated > 0 ? `${m.donated} times` : "None yet" },
                          ].map(({ label, val }) => (
                            <div key={label} className="space-y-0.5">
                              <div className="font-body text-[10px] text-muted-foreground font-black uppercase tracking-widest">{label}</div>
                              <div className="font-body text-sm font-bold text-foreground/80">{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={() => handleContact(m.id)}
                        className={`w-full md:w-auto h-12 px-8 rounded-xl font-body font-black text-xs uppercase tracking-widest shadow-md transition-all group-hover:translate-x-1 ${m.matchPct >= 90 ? "bg-secondary text-white hover:bg-secondary/90" : "bg-marrow text-white hover:bg-marrow/90"}`}
                      >
                        Initiate Confirmation <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>

                    {/* Progress indicator */}
                    <div className="mt-6 pt-5 border-t border-border/50">
                      <div className="flex items-center justify-between overflow-x-auto gap-4 pb-2 scrollbar-none">
                        {["HLA Sequencing", "Counselling", "Health Screening", "Harvest", "Transplant"].map((step, j) => (
                          <div key={step} className="flex items-center gap-2 shrink-0">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-display font-bold text-[10px] ${j === 0 ? "bg-marrow text-white" : "bg-muted text-muted-foreground"}`}>
                              {j + 1}
                            </div>
                            <span className="font-body text-[10px] font-black uppercase tracking-tighter text-muted-foreground">{step}</span>
                            {j < 4 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
                <Shield className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-body text-xs font-bold text-orange-900">Privacy Guarantee</h4>
                  <p className="font-body text-[11px] text-orange-800 leading-tight mt-0.5">
                    MarrowMatch uses anonymized identifiers. Full identity matches are only shared with medical professionals once confirmation testing is complete.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Register HLA Modal */}
      <AnimatePresence>
        {showRegModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-card rounded-3xl border-2 border-marrow/20 shadow-2xl overflow-hidden"
            >
              <div className="bg-marrow p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-display text-xl font-bold">HLA Registration</h3>
                  <p className="text-white/70 text-xs font-body uppercase tracking-widest font-bold">Genetic Fingerprint</p>
                </div>
                <button
                  onClick={() => setShowRegModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterDonor} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">HLA-A</Label>
                    <Input
                      placeholder="e.g. A*02:01"
                      className="rounded-xl font-body"
                      value={hlaInput.hlaA}
                      onChange={(e) => setHlaInput({ ...hlaInput, hlaA: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">HLA-B</Label>
                    <Input
                      placeholder="e.g. B*07:02"
                      className="rounded-xl font-body"
                      value={hlaInput.hlaB}
                      onChange={(e) => setHlaInput({ ...hlaInput, hlaB: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">HLA-C</Label>
                    <Input
                      placeholder="e.g. C*07:01"
                      className="rounded-xl font-body"
                      value={hlaInput.hlaC}
                      onChange={(e) => setHlaInput({ ...hlaInput, hlaC: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">HLA-DRB1</Label>
                    <Input
                      placeholder="e.g. DR15"
                      className="rounded-xl font-body"
                      value={hlaInput.hlaDR}
                      onChange={(e) => setHlaInput({ ...hlaInput, hlaDR: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-marrow/5 border border-marrow/10">
                  <p className="font-body text-[11px] text-marrow font-bold uppercase tracking-tighter">Medical Confirmation Required</p>
                  <p className="font-body text-[10px] text-muted-foreground leading-tight mt-1">
                    Your preliminary HLA values will make you searchable. A buccal swab or blood test will be required for final validation if a potential match is found.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full bg-marrow text-white font-bold h-12 rounded-xl mt-4"
                >
                  {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authorize Registry Entry"}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />

      {/* Contact Success Modal */}
      <AnimatePresence>
        {contactSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border-2 border-marrow/30 rounded-2xl p-7 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-marrow/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-marrow" />
                  </div>
                  <h2 className="font-display text-xl font-bold">Request Submitted</h2>
                </div>
                <button
                  onClick={() => setContactSuccess(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="font-body text-sm text-foreground">
                  Your request to contact <strong>{contactSuccess.donor_name}</strong> in{" "}
                  {contactSuccess.donor_city} has been received.
                </p>
                <div className="bg-marrow/5 border border-marrow/20 rounded-xl p-4">
                  <p className="font-body text-xs font-bold text-marrow uppercase tracking-wider mb-2">
                    Next Steps
                  </p>
                  <ul className="space-y-2">
                    {contactSuccess.next_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-marrow mt-0.5">•</span>
                        <span className="font-body text-xs text-muted-foreground">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  onClick={() => setContactSuccess(null)}
                  className="w-full bg-marrow text-primary-foreground font-body font-bold rounded-xl mt-2"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}



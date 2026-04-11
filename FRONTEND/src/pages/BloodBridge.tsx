import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Clock, AlertTriangle, CheckCircle2, Plus, Filter, ArrowLeft, Loader2, Search, Heart, Droplets, Shield, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BloodBridgeMap from "@/components/BloodBridgeMap";
import { api, BloodDonor, BloodRequest, isLoggedIn, getCurrentUserId } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/AuthContext";

export default function BloodBridge() {
  const { role, userName, profile } = useAuth();
  const isDonor = role === "donor";
  const isHospital = role === "hospital";

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [selectedDonorProfile, setSelectedDonorProfile] = useState<BloodDonor | null>(null);
  const [donors, setDonors] = useState<BloodDonor[]>([]);
  const [urgentRequests, setUrgentRequests] = useState<BloodRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Donors see requests matching their blood group; hospitals see all open requests
        const reqsPromise = isDonor
          ? api.blood.getRequestsForDonor(getCurrentUserId())
          : api.blood.getOpenRequests();

        const [reqs, initialDonors] = await Promise.all([
          reqsPromise,
          isHospital ? api.blood.getDonors({ limit: 4 }) : Promise.resolve([])
        ]);
        setUrgentRequests(reqs);
        setDonors(initialDonors);
      } catch (error) {
        console.error("Failed to fetch initial data", error);
        toast.error("Could not load latest requests");
      } finally {
        setIsInitialLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSearch = async () => {
    if (!isLoggedIn()) {
      toast.error("Please login to search the donor registry");
      return;
    }
    setIsLoading(true);
    try {
      const isPincode = /^\d{6}$/.test(locationInput.trim());
      const searchParams = {
        blood_group: selectedGroup || undefined,
        city: !isPincode ? locationInput.trim() || undefined : undefined,
        pincode: isPincode ? locationInput.trim() : undefined,
        limit: 20
      };

      const results = await api.blood.getDonors(searchParams);
      setDonors(results);

      if (results.length === 0) {
        toast.info("No matching donors found in this area.");
      } else {
        toast.success(`Found ${results.length} matching donors!`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to search donors");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequest = async (donor: BloodDonor) => {
    if (!isLoggedIn()) {
      toast.error("Please login to request donation");
      return;
    }
    if (!donor.eligible_to_donate) {
      toast.error(`${donor.name} is busy or not eligible yet.`);
      return;
    }

    const hospitalId = getCurrentUserId();
    if (!hospitalId || role !== "hospital") {
      toast.error("Only verified hospitals can send direct requests.");
      return;
    }

    try {
      const res: any = await api.blood.requestDonor({
        hospital_id: hospitalId,
        donor_id: donor.id,
        blood_group: donor.group,
        units: 1,
        urgency: "URGENT"
      });

      if (res.success) {
        toast.success(`Request sent to ${donor.name}!`, {
          description: res.message,
          icon: <CheckCircle2 className="w-4 h-4 text-secondary" />
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send request");
    }
  };

  const handlePostRequest = () => {
    if (role !== "hospital") {
      toast.error("Only verified hospitals can post urgent blood requirements.");
      return;
    }
    toast.info("Opening Hospital Urgent Request portal...");
  };

  const handleDonorRespond = (req: BloodRequest) => {
    if (!isLoggedIn()) {
      toast.error("Please login to respond to requests");
      return;
    }
    toast.success(`You've pledged to donate ${req.group} blood!`, {
      description: `${req.hospital} has been notified. You'll receive coordination details shortly.`,
      icon: <Heart className="text-blood w-4 h-4" />
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        {/* Module hero */}
        <div className="bg-gradient-to-br from-blood/90 to-blood/60 text-primary-foreground py-16 px-4">
          <div className="container mx-auto">
            <Link to="/" className="inline-flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground font-body text-sm mb-6 transition-colors">
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
            <div className="flex gap-6 mt-6 flex-wrap">
              {[
                { label: "Active Donors", value: "4,217" },
                { label: "Matches Today", value: "847" },
                { label: "Avg Match Time", value: "4 min" },
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ─── SIDEBAR ─── */}
            <div className="space-y-5">

              {/* ── DONOR SIDEBAR: My Status + Quick Info ── */}
              {isDonor && (
                <>
                  <div className="rounded-2xl border-2 border-blood/20 bg-card p-6 shadow-card overflow-hidden relative">
                    <div className="absolute -top-8 -right-8 opacity-5"><Droplets size={120} /></div>
                    <h3 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2 relative z-10">
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
                            {profile?.is_verified ? "✓ Verified" : "Active Donor"}
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

                  {/* Quick tips for donors */}
                  <div className="rounded-2xl border-2 border-secondary/20 bg-secondary/5 p-5">
                    <h3 className="font-display text-sm font-bold mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-secondary" /> Donation Readiness
                    </h3>
                    <div className="space-y-2.5">
                      {[
                        "Stay hydrated before donating",
                        "Last donation must be 90+ days ago",
                        "Carry a valid government ID",
                        "Eat well before the appointment"
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

              {/* ── HOSPITAL / NGO SIDEBAR: Find Donors + Post Request ── */}
              {(isHospital || !role) && (
                <>
                  <div className="rounded-2xl border-2 border-blood/20 bg-card p-5 shadow-card">
                    <h3 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                      <Filter className="w-5 h-5 text-blood" /> Find Donors
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Blood Group</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((g) => (
                            <button
                              key={g}
                              onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
                              className={`h-9 rounded-lg border-2 font-display text-xs font-bold transition-all ${selectedGroup === g ? "border-blood bg-blood text-white" : "border-border hover:border-blood hover:bg-blood/10"}`}
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
                          onChange={(e) => setLocationInput(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Units Required</label>
                        <Input type="number" placeholder="e.g. 2" className="h-10 rounded-xl font-body" defaultValue={1} />
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

                  {/* Post request */}
                  <div className="rounded-2xl border-2 border-blood/20 bg-blood/5 p-5">
                    <h3 className="font-display text-base font-bold text-foreground mb-2">Hospital? Post Urgent Need</h3>
                    <p className="font-body text-xs text-muted-foreground mb-3">Notify verified donors near your hospital instantly.</p>
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

            {/* ─── MAIN CONTENT ─── */}
            <div className="lg:col-span-2 space-y-6">

              {/* ── DONOR VIEW: Urgent requests they can respond to ── */}
              {isDonor && (
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-blood animate-pulse" /> Hospitals Need Your Help
                  </h3>
                  <div className="space-y-3">
                    {isInitialLoading && (
                      <div className="flex justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-blood" />
                      </div>
                    )}
                    {urgentRequests.length === 0 && !isInitialLoading && (
                      <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/5">
                        <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                        <p className="text-muted-foreground font-body font-semibold">No active blood requests in your area right now.</p>
                        <p className="text-muted-foreground font-body text-xs mt-1">You'll be notified when a patient nearby needs your blood group.</p>
                      </div>
                    )}
                    {urgentRequests.map((req, i) => (
                      <motion.div
                        key={req.id || i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className={`rounded-2xl border-2 bg-card p-5 shadow-card transition-all hover:shadow-lg ${req.urgency === "CRITICAL" ? "border-blood/40" : "border-blood/15"}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-blood/10 flex items-center justify-center shrink-0">
                            <span className="font-display font-black text-blood text-lg">{req.group}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-display font-bold text-base">{req.hospital}</span>
                              <Badge className={`text-[10px] border-0 font-body font-black uppercase tracking-tighter ${req.urgency === "CRITICAL" ? "bg-blood/15 text-blood animate-pulse" : req.urgency === "URGENT" ? "bg-platelet/15 text-platelet" : "bg-muted text-muted-foreground"}`}>
                                {req.urgency}
                              </Badge>
                            </div>
                            <div className="font-body text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                              <span className="font-bold">{req.units} unit(s) needed</span>
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {req.city}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-3">
                              <div className={`flex items-center gap-1 font-body font-bold text-sm ${(req.hours_left ?? 999) < 24 ? "text-blood" : "text-platelet"}`}>
                                <Clock className="w-3.5 h-3.5" /> {req.timeLeft} remaining
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleDonorRespond(req)}
                            className="bg-blood text-white font-body font-bold rounded-xl h-11 px-6 shadow-md hover:scale-[1.03] transition-transform shrink-0"
                          >
                            <Heart className="w-4 h-4 mr-1.5" /> I'll Donate
                          </Button>
                        </div>

                        {/* Compatibility hint */}
                        {profile?.blood_group && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="font-body text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                              <span>Your blood group <strong className="text-blood">{profile.blood_group}</strong> {profile.blood_group === req.group ? "is a direct match!" : "may be compatible — tap to check."}</span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {/* Donation history teaser */}
                  <div className="mt-8 p-5 rounded-2xl bg-muted/30 border-2 border-border/50">
                    <h4 className="font-display text-base font-bold mb-3 flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blood" /> Your Impact
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-card rounded-xl border border-border">
                        <div className="font-display font-black text-2xl text-blood">0</div>
                        <div className="font-body text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Donations</div>
                      </div>
                      <div className="text-center p-3 bg-card rounded-xl border border-border">
                        <div className="font-display font-black text-2xl text-secondary">0</div>
                        <div className="font-body text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Lives Saved</div>
                      </div>
                      <div className="text-center p-3 bg-card rounded-xl border border-border">
                        <div className="font-display font-black text-2xl text-foreground/70">—</div>
                        <div className="font-body text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Last Donated</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── HOSPITAL / GUEST VIEW: Urgent requests + Donor cards + Map ── */}
              {(isHospital || !role) && (
                <>
                  {/* Urgent requests */}
                  <div>
                    <h3 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-blood animate-pulse" /> Live Urgent Requests
                    </h3>
                    <div className="space-y-3">
                      {urgentRequests.length === 0 && !isInitialLoading && (
                        <div className="p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground font-body">
                          No active urgent requests at the moment.
                        </div>
                      )}
                      {urgentRequests.map((req, i) => (
                        <motion.div
                          key={req.id || i}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="rounded-xl border-2 border-blood/20 bg-card p-4 flex items-center gap-4"
                        >
                          <div className="w-12 h-12 rounded-xl bg-blood/10 flex items-center justify-center">
                            <span className="font-display font-black text-blood text-sm">{req.group}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-body font-bold text-sm">{req.hospital}</span>
                              <Badge className={`text-xs border-0 font-body ${req.urgency === "CRITICAL" ? "bg-blood/15 text-blood" : req.urgency === "URGENT" ? "bg-platelet/15 text-platelet" : "bg-muted text-muted-foreground"}`}>
                                {req.urgency}
                              </Badge>
                            </div>
                            <div className="font-body text-xs text-muted-foreground mt-0.5">
                              {req.units} unit(s) · <MapPin className="w-3 h-3 inline" /> {req.city}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-blood font-body font-bold text-sm">
                              <Clock className="w-3.5 h-3.5" /> {req.timeLeft}
                            </div>
                            <div className="font-body text-xs text-muted-foreground">remaining</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Donor cards */}
                  <div>
                    <h3 className="font-display text-xl font-bold text-foreground mb-4">
                      {selectedGroup ? `Available Donors (${selectedGroup})` : "Available Donors"}
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
                          transition={{ delay: i * 0.08 }}
                          className={`rounded-xl border-2 bg-card p-4 shadow-card ${donor.available ? "border-secondary/30" : "border-border opacity-60"}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blood/10 flex items-center justify-center font-display font-bold text-blood">
                                {donor.name[0]}
                              </div>
                              <div>
                                <div className="font-body font-bold text-sm text-foreground">{donor.name}</div>
                                <div className="font-body text-xs text-muted-foreground">{donor.city}</div>
                              </div>
                            </div>
                            <Badge className={`font-body text-xs border-0 ${donor.available ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}>
                              {donor.available ? "Available" : "Busy"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-body text-muted-foreground mb-3">
                            <span className="font-bold text-blood">{donor.group}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 inline" /> {donor.city}</span>
                            <span>⭐ {donor.trust}</span>
                            <span>Last: {donor.last_donated}</span>
                          </div>
                          {donor.available && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 border-border font-body text-xs rounded-lg" onClick={() => setSelectedDonorProfile(donor)}>
                                View Profile
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRequest(donor)}
                                className="flex-1 bg-blood text-primary-foreground font-body text-xs rounded-lg"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Request
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Donor Map */}
                  <div>
                    <h3 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blood" /> Nearby Donors
                    </h3>
                    <div className="rounded-2xl border-2 border-blood/20 bg-card shadow-card overflow-hidden">
                      <BloodBridgeMap
                        donors={donors.map(d => ({
                          id: d.id,
                          name: d.name,
                          blood_group: d.group,
                          city: d.city,
                          trust_score: d.trust,
                          distance_km: d.distance_km || 0,
                          lat: 0,
                          lng: 0,
                        }))}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />

      <Dialog open={!!selectedDonorProfile} onOpenChange={(open) => !open && setSelectedDonorProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-blood/10 flex items-center justify-center text-blood text-xl font-black">
                {selectedDonorProfile?.name[0]}
              </div>
              <div>
                <div className="text-xl">{selectedDonorProfile?.name}</div>
                <div className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {selectedDonorProfile?.distance || selectedDonorProfile?.city}
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
                <div className="font-body text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Trust Score</div>
              </div>
              <div className="flex-1 text-center flex flex-col items-center justify-center">
                <Badge className={`font-body text-xs border-0 ${selectedDonorProfile?.available ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}>
                  {selectedDonorProfile?.available ? "Available" : "Busy"}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 font-body text-sm pt-2">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Location</span>
                <span className="font-semibold text-foreground text-right">{selectedDonorProfile?.city}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Last Donated</span>
                <span className="font-semibold text-foreground">{selectedDonorProfile?.last_donated || "No record"}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-foreground">Verified User</span>
                <span className="font-semibold text-secondary flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                </span>
              </div>
            </div>

            <Button
              className="w-full h-11 bg-blood hover:bg-blood/90 text-white font-body font-bold rounded-xl mt-4"
              onClick={() => {
                if (selectedDonorProfile) handleRequest(selectedDonorProfile);
                setSelectedDonorProfile(null);
              }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Request Donation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

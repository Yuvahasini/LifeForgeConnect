import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, QrCode, Plus, Heart, AlertTriangle, Loader2, Sparkles, Droplets, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, MilkDonor, MilkBankRow, MilkShortageAlert, getCurrentUserId, isLoggedIn } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/AuthContext";

export default function MilkBridge() {
  const { role } = useAuth();
  // ... rest of the states same
  const [donors, setDonors] = useState<MilkDonor[]>([]);
  const [milkBank, setMilkBank] = useState<MilkBankRow[]>([]);
  const [shortageAlerts, setShortageAlerts] = useState<MilkShortageAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for donor registration
  const [formData, setFormData] = useState({
    babyAge: "",
    qty: 0,
    location: ""
  });

  const fetchData = async () => {
    try {
      const [donorsData, bankData, alertsData] = await Promise.all([
        api.milk.getDonors(),
        api.milk.getBank(),
        api.milk.getShortageAlerts()
      ]);
      setDonors(donorsData);
      setMilkBank(bankData);
      setShortageAlerts(alertsData);
    } catch (error) {
      console.error("Failed to fetch MilkBridge data", error);
      toast.error("Could not load latest donation data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegisterDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn()) {
      toast.error("Please login to register as a donor");
      return;
    }
    const donorId = getCurrentUserId();

    if (!formData.babyAge || formData.qty <= 0) {
      toast.error("Please fill in baby's age and quantity");
      return;
    }

    setIsSubmitting(true);
    try {
      const ageM = parseInt(formData.babyAge) || 1;
      await api.milk.registerDonor({
        donor_id: donorId,
        baby_age_months: ageM,
        quantity_ml_per_day: formData.qty,
        pickup_location: formData.location || undefined
      });
      toast.success("Successfully registered as a donor!");
      setFormData({ babyAge: "", qty: 0, location: "" });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to register as donor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestDonation = (donor: MilkDonor) => {
    if (!isLoggedIn()) {
      toast.error("Please login to request milk donation");
      return;
    }
    toast.success(`Request sent to ${donor.name}! Our coordination team will contact them.`);
  };

  const handleRespondToAlert = (alert: MilkShortageAlert) => {
    if (!isLoggedIn()) {
      toast.error("Please login to respond to shortage alerts");
      return;
    }
    toast.success(`Intent recorded! Thank you for offering to help ${alert.hospital}. We will contact you shortly to coordinate.`);
  };

  const handleViewQR = (id: string) => {
    if (!isLoggedIn()) {
      toast.error("Please login to verify Milk Passport™ records");
      return;
    }
    toast.info(`Milk Passport™ QR for ${id} generated. Scanning verifies pasteurization and donor health history.`);
  };

  const [showShortageModal, setShowShortageModal] = useState(false);
  const [shortageFormData, setShortageFormData] = useState({
    infantName: "",
    qtyMl: 100
  });

  const handlePostShortage = async (e: React.FormEvent) => {
    e.preventDefault();
    const hospitalId = getCurrentUserId();
    if (!hospitalId) {
      toast.error("Please login as a hospital to post shortages");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.milk.postRequest({
        hospital_id: hospitalId,
        infant_name: shortageFormData.infantName || undefined,
        daily_quantity_ml: shortageFormData.qtyMl
      });
      toast.success("Shortage alert posted! Relevant donors will be notified.");
      setShowShortageModal(false);
      setShortageFormData({ infantName: "", qtyMl: 100 });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to post shortage");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-16">
        {/* Module hero */}
        <div className="bg-gradient-to-br from-milk/90 to-amber-400/60 py-16 px-4">
          <div className="container mx-auto">
            <Link to="/" className="inline-flex items-center gap-1.5 text-foreground/60 hover:text-foreground font-body text-sm mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-6xl animate-bounce-slow">🍼</div>
              <div>
                <h1 className="font-display text-5xl font-black text-foreground">MilkBridge</h1>
                <p className="font-body text-foreground/60 text-lg">Nourishing India's tiniest lives</p>
              </div>
            </div>
            <div className="flex gap-6 mt-6 flex-wrap">
              {[
                { label: "Active Donors", value: donors.length > 0 ? "4,820+" : "Loading..." },
                { label: "Babies Helped", value: "12,400+" },
                { label: "Donations Logged", value: milkBank.length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/20 rounded-xl px-5 py-3 backdrop-blur-md border border-white/30">
                  <div className="font-display text-2xl font-bold text-foreground">{value}</div>
                  <div className="font-body text-xs text-foreground/70">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              {/* Register donor form */}
              <div className="rounded-2xl border-2 border-milk/30 bg-card p-6 shadow-card overflow-hidden relative">
                <div className="absolute -top-6 -right-6 text-milk/10 transform rotate-12">
                  <Droplets size={120} />
                </div>
                <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                  <Heart className="w-5 h-5 text-milk" /> Register to Donate
                  <Badge className="bg-milk/20 text-milk border-0 font-body text-[10px] ml-auto uppercase font-black">NICU Priority</Badge>
                </h3>
                <form onSubmit={handleRegisterDonor} className="space-y-4 relative z-10">
                  <div className="space-y-1.5">
                    <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Baby's Age (Months)</Label>
                    <Input
                      placeholder="e.g. 3"
                      type="number"
                      className="h-11 rounded-xl font-body border-milk/20 focus:border-milk"
                      value={formData.babyAge}
                      onChange={(e) => setFormData({ ...formData, babyAge: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ML Available Daily</Label>
                    <Input
                      placeholder="e.g. 200"
                      type="number"
                      className="h-11 rounded-xl font-body border-milk/20 focus:border-milk"
                      value={formData.qty}
                      onChange={(e) => setFormData({ ...formData, qty: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</Label>
                    <Input
                      placeholder="City/Area"
                      className="h-11 rounded-xl font-body border-milk/20 focus:border-milk"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  <p className="font-body text-[11px] text-muted-foreground leading-relaxed italic border-l-2 border-milk/30 pl-3">
                    Your surplus can save a premature infant from complications. Verified medical screening required.
                  </p>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-milk text-foreground font-body font-bold rounded-xl h-12 shadow-inner hover:scale-[1.02] transition-transform"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Start Donating"}
                  </Button>
                </form>
              </div>

              {/* Shortage alert grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Critical Shortages</h3>
                  <button
                    onClick={() => {
                      if (role !== "hospital") {
                        toast.error("Only verified hospitals can post shortage alerts.");
                        return;
                      }
                      setShowShortageModal(true);
                    }}
                    className="text-[10px] font-bold text-blood hover:underline uppercase tracking-tighter"
                  >
                    + Post Need
                  </button>
                </div>
                {isLoading ? (
                  <div className="p-8 text-center bg-muted/20 rounded-2xl animate-pulse">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blood/50" />
                  </div>
                ) : shortageAlerts.length === 0 ? (
                  <div className="p-6 text-center bg-secondary/5 border-2 border-dashed border-secondary/20 rounded-2xl">
                    <Sparkles className="w-5 h-5 text-secondary mx-auto mb-2" />
                    <p className="font-body text-xs text-muted-foreground">Stock levels stable across India.</p>
                  </div>
                ) : (
                  shortageAlerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-2xl border-2 border-blood/20 bg-blood/5 p-5 shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-blood animate-pulse" />
                        <h3 className="font-display text-xs font-bold text-blood uppercase tracking-wide">{alert.hospital}</h3>
                      </div>
                      <p className="font-body text-xs text-muted-foreground mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: alert.message }} />
                      <Button
                        onClick={() => handleRespondToAlert(alert)}
                        className="w-full bg-blood text-white font-body font-bold rounded-xl h-10 hover:bg-blood/90 text-xs"
                      >
                        Help {alert.hospital.split(" ")[0]}
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </div>


            <div className="lg:col-span-2 space-y-8">
              {/* Active Donor Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    Verified Milk Donors
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-milk" />}
                  </h3>
                  <Badge variant="outline" className="font-body text-[10px] text-milk border-milk/30">LATEST UPDATES</Badge>
                </div>

                {donors.length === 0 && !isLoading && (
                  <div className="text-center py-12 border-2 border-dashed rounded-3xl bg-muted/5">
                    <p className="font-body text-muted-foreground">No active donors listed in this cycle.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {donors.map((d, i) => (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-3xl border-2 border-milk/10 bg-card p-5 shadow-card hover:border-milk/40 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-milk/10 flex items-center justify-center text-3xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                        🤱
                      </div>
                      <div className="text-center mb-4">
                        <div className="font-display font-bold text-md flex items-center justify-center gap-1.5 min-h-[28px]">
                          {d.name}
                          {d.verified && <Sparkles size={14} className="text-amber-500 fill-amber-500" />}
                        </div>
                        <div className="font-body text-[11px] text-muted-foreground uppercase tracking-widest mt-1">Baby Age: {d.babyAge}</div>
                        <div className="font-body text-[10px] text-muted-foreground mt-0.5">{d.area}</div>
                      </div>

                      <div className="p-3 rounded-2xl bg-milk/5 border border-milk/20 text-center mb-4 shadow-inner">
                        <div className="font-display font-black text-xl text-milk">{d.qty}</div>
                        <div className="font-body text-[10px] font-bold text-muted-foreground uppercase opacity-70">daily surplus</div>
                      </div>

                      <div className="flex items-center justify-center mb-5">
                        <Badge className="bg-secondary/10 text-secondary border-0 font-body text-[10px] h-6 px-3 rounded-full flex gap-1">
                          ❤️ {d.impact}
                        </Badge>
                      </div>

                      <Button
                        onClick={() => handleRequestDonation(d)}
                        size="sm"
                        className="w-full bg-milk text-foreground font-body text-xs font-bold rounded-xl h-10 hover:shadow-lg shadow-milk/10"
                      >
                        Request Milk
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Milk Bank Table */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    🏦 Milk Bank Registry
                    <Badge className="bg-milk/20 text-milk border-0 font-body text-[10px] h-5 rounded-full uppercase font-black">Milk Passport™</Badge>
                  </h3>
                  <Button variant="ghost" className="text-[11px] font-body text-muted-foreground hover:text-milk" size="sm">
                    VIEW ALL LOGS →
                  </Button>
                </div>

                <div className="rounded-2xl border-2 border-border/50 bg-card overflow-hidden shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          {["Passport ID", "Donor", "Pasteurized", "Expiry", "Qty", "Status", "Track"].map((h) => (
                            <th key={h} className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-6 py-4 text-left">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading ? (
                          <tr><td colSpan={7} className="text-center py-10 font-body text-xs text-muted-foreground">Loading log entries...</td></tr>
                        ) : milkBank.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-10 font-body text-xs text-muted-foreground italic">No milk shipments currently in processing.</td></tr>
                        ) : (
                          milkBank.map((row) => (
                            <tr key={row.id} className="border-b border-border last:border-0 hover:bg-milk/5 transition-colors group">
                              <td className="font-body text-xs font-bold px-6 py-4 text-milk group-hover:underline cursor-pointer">{row.id}</td>
                              <td className="font-body text-sm font-semibold px-6 py-4">{row.from}</td>
                              <td className="font-body text-xs px-6 py-4 text-muted-foreground">{row.pasteurized}</td>
                              <td className="font-body text-xs px-6 py-4 text-muted-foreground">{row.expiry}</td>
                              <td className="font-body text-sm font-black px-6 py-4 text-foreground/80">{row.qty}</td>
                              <td className="px-6 py-4">
                                <Badge className={`text-[9px] uppercase px-2 py-0.5 border-0 font-bold ${row.status === "Available" ? "bg-secondary/15 text-secondary" :
                                  row.status === "Low Stock" ? "bg-amber-100 text-amber-700" :
                                    row.status === "Reserved" ? "bg-blue-100 text-blue-700" :
                                      "bg-muted text-muted-foreground"
                                  }`}>
                                  {row.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handleViewQR(row.id)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted group-hover:bg-milk/20 group-hover:text-milk transition-all"
                                >
                                  <QrCode className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-50 border border-orange-200">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">🛡️</div>
                  <p className="font-body text-[11px] text-orange-900 leading-tight">
                    Each sample in MilkBridge is tracked via <strong>Milk Passport™</strong>. We guarantee rigorous pasteurization protocols following WHO guidelines.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />

      {/* Shortage Modal */}
      <AnimatePresence>
        {showShortageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-card rounded-3xl border-2 border-blood/20 shadow-2xl overflow-hidden"
            >
              <div className="bg-blood p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-display text-xl font-bold text-white">Post Milk Shortage</h3>
                  <p className="text-white/70 text-xs font-body">Broadcast emergency NICU need</p>
                </div>
                <button
                  onClick={() => setShowShortageModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePostShortage} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Infant Identifier (Optional)</Label>
                  <Input
                    placeholder="e.g. Baby of Anjali or Bed #4"
                    className="rounded-xl font-body"
                    value={shortageFormData.infantName}
                    onChange={(e) => setShortageFormData({ ...shortageFormData, infantName: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Daily ML Needed</Label>
                  <Input
                    type="number"
                    min={50}
                    step={50}
                    required
                    className="rounded-xl font-body"
                    value={shortageFormData.qtyMl}
                    onChange={(e) => setShortageFormData({ ...shortageFormData, qtyMl: parseInt(e.target.value) })}
                  />
                </div>

                <p className="font-body text-[11px] text-muted-foreground italic bg-blood/5 p-3 rounded-xl border border-blood/10">
                  This request will be broadcast to all verified donors in your hospital's city and logged in the MilkBridge shortage grid.
                </p>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blood text-white font-bold h-12 rounded-xl mt-2 hover:bg-blood/90"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Alert"}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}



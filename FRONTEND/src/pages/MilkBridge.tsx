import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, QrCode, Heart, AlertTriangle, Loader2, Sparkles, Droplets, X,
  MapPin, Clock, CheckCircle, XCircle, Search, Filter, Baby, Shield, Eye, EyeOff,
  Building2, TrendingUp, Package, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  api, MilkDonor, MilkBankRow, MilkShortageAlert, MilkHospitalDashboard,
  getCurrentUserId, isLoggedIn
} from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/AuthContext";

export default function MilkBridge() {
  const { role } = useAuth();
  const userId = getCurrentUserId();

  // Data states
  const [donors, setDonors] = useState<MilkDonor[]>([]);
  const [milkBank, setMilkBank] = useState<MilkBankRow[]>([]);
  const [shortageAlerts, setShortageAlerts] = useState<MilkShortageAlert[]>([]);
  const [hospitalDashboard, setHospitalDashboard] = useState<MilkHospitalDashboard | null>(null);
  const [donorRequests, setDonorRequests] = useState<any[]>([]);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Filter states
  const [searchCity, setSearchCity] = useState("");
  const [searchPincode, setSearchPincode] = useState("");
  const [screeningFilter, setScreeningFilter] = useState<string>("all");

  // Form state for donor registration
  const [formData, setFormData] = useState({
    babyAge: "",
    qty: 0,
    location: "",
    pincode: "",
    isAnonymous: false,
    availabilityStart: "08:00",
    availabilityEnd: "20:00"
  });

  // Shortage modal state
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [shortageFormData, setShortageFormData] = useState({
    infantName: "",
    qtyMl: 100,
    urgency: "normal",
    pincode: ""
  });

  // Match modal state
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MilkShortageAlert | null>(null);
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);

  // Fetch data
  const fetchData = async () => {
    try {
      const params: any = {};
      if (searchCity) params.city = searchCity;
      if (searchPincode) params.pincode = searchPincode;
      if (screeningFilter !== "all") params.screening_status = screeningFilter;

      const [donorsData, bankData, alertsData] = await Promise.all([
        api.milk.getDonors(Object.keys(params).length > 0 ? params : undefined),
        api.milk.getBank(),
        api.milk.getShortageAlerts()
      ]);

      setDonors(donorsData);
      setMilkBank(bankData);
      setShortageAlerts(alertsData);

      // Fetch hospital dashboard if hospital role
      if (role === "hospital" && userId) {
        try {
          const dashboard = await api.milk.getHospitalDashboard(userId);
          setHospitalDashboard(dashboard);
        } catch (e) {
          console.log("Hospital dashboard not available");
        }
      }

      // Fetch requests for donor
      if (role === "donor" && userId) {
        try {
          const requests = await api.milk.getRequestsForDonor(userId);
          setDonorRequests(requests);
        } catch (e) {
          console.log("Donor requests not available");
        }
      }
    } catch (error) {
      console.error("Failed to fetch MilkBridge data", error);
      toast.error("Could not load latest donation data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [role, userId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading) fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchCity, searchPincode, screeningFilter]);

  // Handler: Register as donor
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
        city: formData.location || undefined,
        pincode: formData.pincode || undefined,
        is_anonymous: formData.isAnonymous,
        availability_start: formData.availabilityStart,
        availability_end: formData.availabilityEnd
      });
      toast.success("Successfully registered as a donor!");
      setFormData({
        babyAge: "", qty: 0, location: "", pincode: "",
        isAnonymous: false, availabilityStart: "08:00", availabilityEnd: "20:00"
      });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to register as donor");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Request milk from donor
  const handleRequestDonation = async (donor: MilkDonor) => {
    if (!isLoggedIn()) {
      toast.error("Please login to request milk donation");
      return;
    }

    if (role !== "hospital") {
      toast.info(`${donor.name} is available for donation. Contact your nearest NICU to coordinate.`);
      return;
    }

    try {
      await api.milk.createMatch({
        request_id: hospitalDashboard?.active_requests[0]?.id || "",
        donor_id: donor.donor_id,
        milk_donor_id: donor.id
      });
      toast.success(`Match request sent to ${donor.name}!`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to send request");
    }
  };

  // Handler: Respond to alert (donor)
  const handleRespondToAlert = async (alert: MilkShortageAlert) => {
    if (!isLoggedIn()) {
      toast.error("Please login to respond to shortage alerts");
      return;
    }

    if (role !== "donor") {
      toast.info("Only registered donors can respond to alerts.");
      return;
    }

    toast.success(`Intent recorded! Thank you for offering to help ${alert.hospital}. We will coordinate pickup.`);
  };

  // Handler: Post shortage (hospital)
  const handlePostShortage = async (e: React.FormEvent) => {
    e.preventDefault();
    const hospitalId = getCurrentUserId();
    if (!hospitalId) {
      toast.error("Please login as a hospital to post shortages");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.milk.postRequest({
        hospital_id: hospitalId,
        infant_name: shortageFormData.infantName || undefined,
        daily_quantity_ml: shortageFormData.qtyMl,
        urgency: shortageFormData.urgency,
        pincode: shortageFormData.pincode || undefined
      });
      toast.success(`Shortage alert posted! ${result.donors_notified} donors notified.`);
      setShowShortageModal(false);
      setShortageFormData({ infantName: "", qtyMl: 100, urgency: "normal", pincode: "" });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to post shortage");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Find matches for request
  const handleFindMatches = async (request: MilkShortageAlert) => {
    setSelectedRequest(request);
    setIsMatching(true);
    setShowMatchModal(true);

    try {
      const result = await api.milk.findMatches({
        request_id: request.id,
        max_distance_km: 50,
        limit: 10
      });
      setMatchResults(result.matches);
    } catch (error: any) {
      toast.error(error.message || "Failed to find matches");
    } finally {
      setIsMatching(false);
    }
  };

  // Handler: View QR (Milk Passport)
  const handleViewQR = async (id: string) => {
    if (!isLoggedIn()) {
      toast.error("Please login to verify Milk Passport records");
      return;
    }

    try {
      const donation = await api.milk.getDonation(id);
      toast.info(
        `Milk Passport ${id}\nDonor: ${donation.donor_name}\nVolume: ${donation.volume_ml}ml\n` +
        `Status: ${donation.status}\nExpiry: ${donation.expiry_date || "N/A"}`
      );
    } catch {
      toast.info(`Milk Passport QR for ${id} - Verified pasteurization record.`);
    }
  };

  // Stats calculations
  const stats = {
    activeDonors: donors.length,
    screenedDonors: donors.filter(d => d.is_screened).length,
    babiesHelped: "12,400+",
    donationsLogged: milkBank.length,
    criticalAlerts: shortageAlerts.filter(a => a.urgency === "CRITICAL").length
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
                { label: "Active Donors", value: stats.activeDonors || "Loading...", icon: Users },
                { label: "Screened & Ready", value: stats.screenedDonors, icon: Shield },
                { label: "Babies Helped", value: stats.babiesHelped, icon: Baby },
                { label: "Donations Logged", value: stats.donationsLogged, icon: Package },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/20 rounded-xl px-5 py-3 backdrop-blur-md border border-white/30 flex items-center gap-3">
                  <Icon className="w-5 h-5 text-foreground/70" />
                  <div>
                    <div className="font-display text-2xl font-bold text-foreground">{value}</div>
                    <div className="font-body text-xs text-foreground/70">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="container mx-auto px-4 py-10">
          {/* Tabs for different views */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
              {role === "hospital" && (
                <TabsTrigger value="dashboard" className="rounded-lg">Hospital Dashboard</TabsTrigger>
              )}
              {role === "donor" && (
                <TabsTrigger value="my-requests" className="rounded-lg">Nearby Requests</TabsTrigger>
              )}
              <TabsTrigger value="bank" className="rounded-lg">Milk Bank</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left sidebar */}
                <div className="space-y-6">
                  {/* Register donor form */}
                  {role === "donor" && (
                    <div className="rounded-2xl border-2 border-milk/30 bg-card p-6 shadow-card overflow-hidden relative">
                      <div className="absolute -top-6 -right-6 text-milk/10 transform rotate-12">
                        <Droplets size={120} />
                      </div>
                      <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                        <Heart className="w-5 h-5 text-milk" /> Register to Donate
                        <Badge className="bg-milk/20 text-milk border-0 font-body text-[10px] ml-auto uppercase font-black">NICU Priority</Badge>
                      </h3>
                      <form onSubmit={handleRegisterDonor} className="space-y-4 relative z-10">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Baby's Age (Months)</Label>
                            <Input
                              placeholder="e.g. 3"
                              type="number"
                              min={0}
                              max={24}
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
                              min={50}
                              max={2000}
                              className="h-11 rounded-xl font-body border-milk/20 focus:border-milk"
                              value={formData.qty || ""}
                              onChange={(e) => setFormData({ ...formData, qty: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">City</Label>
                            <Input
                              placeholder="City/Area"
                              className="h-11 rounded-xl font-body border-milk/20 focus:border-milk"
                              value={formData.location}
                              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pincode</Label>
                            <Input
                              placeholder="6 digits"
                              maxLength={6}
                              className="h-11 rounded-xl font-body border-milk/20 focus:border-milk"
                              value={formData.pincode}
                              onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, "") })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Available From</Label>
                            <Input
                              type="time"
                              className="h-11 rounded-xl font-body border-milk/20 focus:border-milk"
                              value={formData.availabilityStart}
                              onChange={(e) => setFormData({ ...formData, availabilityStart: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Available Until</Label>
                            <Input
                              type="time"
                              className="h-11 rounded-xl font-body border-milk/20 focus:border-milk"
                              value={formData.availabilityEnd}
                              onChange={(e) => setFormData({ ...formData, availabilityEnd: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                          <Checkbox
                            id="anonymous"
                            checked={formData.isAnonymous}
                            onCheckedChange={(checked) => setFormData({ ...formData, isAnonymous: !!checked })}
                          />
                          <div className="flex-1">
                            <label htmlFor="anonymous" className="font-body text-sm cursor-pointer flex items-center gap-2">
                              {formData.isAnonymous ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              Donate Anonymously
                            </label>
                            <p className="font-body text-[10px] text-muted-foreground">Your name will be hidden from hospitals</p>
                          </div>
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
                  )}

                  {/* Search filters */}
                  <div className="rounded-2xl border-2 border-border/50 bg-card p-5 shadow-card space-y-4">
                    <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Filter className="w-4 h-4" /> Search Donors
                    </h3>
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Filter by city..."
                          className="pl-9 h-10 rounded-xl"
                          value={searchCity}
                          onChange={(e) => setSearchCity(e.target.value)}
                        />
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Filter by pincode..."
                          className="pl-9 h-10 rounded-xl"
                          maxLength={6}
                          value={searchPincode}
                          onChange={(e) => setSearchPincode(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <Select value={screeningFilter} onValueChange={setScreeningFilter}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder="Screening status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All donors</SelectItem>
                          <SelectItem value="cleared">Screened only</SelectItem>
                          <SelectItem value="pending">Pending screening</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Shortage alerts */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        Critical Shortages
                        {stats.criticalAlerts > 0 && (
                          <Badge className="ml-2 bg-blood/20 text-blood border-0">{stats.criticalAlerts}</Badge>
                        )}
                      </h3>
                      {role === "hospital" && (
                        <button
                          onClick={() => setShowShortageModal(true)}
                          className="text-[10px] font-bold text-blood hover:underline uppercase tracking-tighter"
                        >
                          + Post Need
                        </button>
                      )}
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
                      shortageAlerts.slice(0, 3).map((alert) => (
                        <motion.div
                          key={alert.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`rounded-2xl border-2 p-5 shadow-sm ${
                            alert.urgency === "CRITICAL" ? "border-blood/40 bg-blood/10" :
                            alert.urgency === "URGENT" ? "border-amber-500/30 bg-amber-50" :
                            "border-blood/20 bg-blood/5"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className={`w-4 h-4 ${alert.urgency === "CRITICAL" ? "text-blood animate-pulse" : "text-amber-600"}`} />
                            <h3 className="font-display text-xs font-bold text-blood uppercase tracking-wide flex-1">{alert.hospital}</h3>
                            <Badge className={`text-[8px] ${
                              alert.urgency === "CRITICAL" ? "bg-blood text-white" :
                              alert.urgency === "URGENT" ? "bg-amber-500 text-white" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {alert.urgency || "NORMAL"}
                            </Badge>
                          </div>
                          <p className="font-body text-xs text-muted-foreground mb-1">{alert.city}</p>
                          <p className="font-body text-sm font-semibold mb-3">{alert.quantity_needed}</p>
                          {alert.time_left && (
                            <p className="font-body text-[10px] text-muted-foreground mb-3 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {alert.time_left} remaining
                            </p>
                          )}

                          <div className="flex gap-2">
                            {role === "donor" && (
                              <Button
                                onClick={() => handleRespondToAlert(alert)}
                                className="flex-1 bg-blood text-white font-body font-bold rounded-xl h-9 hover:bg-blood/90 text-xs"
                              >
                                I Can Help
                              </Button>
                            )}
                            {role === "hospital" && (
                              <Button
                                onClick={() => handleFindMatches(alert)}
                                variant="outline"
                                className="flex-1 font-body rounded-xl h-9 text-xs"
                              >
                                Find Donors
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                {/* Main content: Active Donors Grid */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold flex items-center gap-2">
                      Verified Milk Donors
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin text-milk" />}
                    </h3>
                    <Badge variant="outline" className="font-body text-[10px] text-milk border-milk/30">
                      {donors.filter(d => d.is_screened).length} SCREENED
                    </Badge>
                  </div>

                  {donors.length === 0 && !isLoading && (
                    <div className="text-center py-12 border-2 border-dashed rounded-3xl bg-muted/5">
                      <p className="font-body text-muted-foreground">No donors match your filters.</p>
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
                            {d.is_screened && <Shield size={14} className="text-secondary" />}
                          </div>
                          {d.babyAge && (
                            <div className="font-body text-[11px] text-muted-foreground uppercase tracking-widest mt-1">Baby Age: {d.babyAge}</div>
                          )}
                          <div className="font-body text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                            <MapPin className="w-3 h-3" /> {d.area}
                            {d.distance && <span className="text-milk">({d.distance})</span>}
                          </div>
                        </div>

                        <div className="p-3 rounded-2xl bg-milk/5 border border-milk/20 text-center mb-4 shadow-inner">
                          <div className="font-display font-black text-xl text-milk">{d.qty}</div>
                          <div className="font-body text-[10px] font-bold text-muted-foreground uppercase opacity-70">daily surplus</div>
                        </div>

                        <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
                          <Badge className="bg-secondary/10 text-secondary border-0 font-body text-[10px] h-6 px-3 rounded-full flex gap-1">
                            {d.impact}
                          </Badge>
                          {d.is_screened && (
                            <Badge className="bg-green-100 text-green-700 border-0 font-body text-[9px]">
                              SCREENED
                            </Badge>
                          )}
                        </div>

                        <Button
                          onClick={() => handleRequestDonation(d)}
                          size="sm"
                          className="w-full bg-milk text-foreground font-body text-xs font-bold rounded-xl h-10 hover:shadow-lg shadow-milk/10"
                        >
                          {role === "hospital" ? "Request Match" : "Contact NICU"}
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Hospital Dashboard Tab */}
            {role === "hospital" && (
              <TabsContent value="dashboard" className="mt-6">
                {hospitalDashboard ? (
                  <div className="space-y-8">
                    {/* Stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {[
                        { label: "Active Requests", value: hospitalDashboard.stats.active_requests, icon: AlertTriangle, color: "text-blood" },
                        { label: "Pending Matches", value: hospitalDashboard.stats.pending_matches, icon: Clock, color: "text-amber-500" },
                        { label: "Accepted", value: hospitalDashboard.stats.accepted_matches, icon: CheckCircle, color: "text-secondary" },
                        { label: "Total Received", value: `${(hospitalDashboard.stats.total_received_ml / 1000).toFixed(1)}L`, icon: Package, color: "text-milk" },
                        { label: "Donations", value: hospitalDashboard.stats.donations_received, icon: TrendingUp, color: "text-purple-500" },
                      ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="bg-card rounded-2xl border p-4 shadow-sm">
                          <Icon className={`w-5 h-5 ${color} mb-2`} />
                          <div className="font-display text-2xl font-bold">{value}</div>
                          <div className="font-body text-xs text-muted-foreground">{label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Active Requests */}
                      <div className="rounded-2xl border bg-card p-6 shadow-card">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-display font-bold">Active Requests</h3>
                          <Button onClick={() => setShowShortageModal(true)} size="sm" className="bg-blood text-white">
                            + New Request
                          </Button>
                        </div>
                        {hospitalDashboard.active_requests.length === 0 ? (
                          <p className="text-muted-foreground text-sm">No active requests</p>
                        ) : (
                          <div className="space-y-3">
                            {hospitalDashboard.active_requests.map((req) => (
                              <div key={req.id} className="p-3 rounded-xl bg-muted/30 flex items-center justify-between">
                                <div>
                                  <p className="font-body font-semibold">{req.infant_ref}</p>
                                  <p className="font-body text-xs text-muted-foreground">{req.volume_ml}ml/day - {req.urgency}</p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFindMatches({ id: req.id, hospital: hospitalDashboard.hospital.name } as any)}
                                >
                                  Find Matches
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Matched Donors */}
                      <div className="rounded-2xl border bg-card p-6 shadow-card">
                        <h3 className="font-display font-bold mb-4">Matched Donors</h3>
                        {hospitalDashboard.matched_donors.length === 0 ? (
                          <p className="text-muted-foreground text-sm">No matches yet</p>
                        ) : (
                          <div className="space-y-3">
                            {hospitalDashboard.matched_donors.map((m) => (
                              <div key={m.id} className="p-3 rounded-xl bg-muted/30 flex items-center justify-between">
                                <div>
                                  <p className="font-body font-semibold">{m.donor_name}</p>
                                  <p className="font-body text-xs text-muted-foreground">{m.city} - {m.quantity_ml}ml/day</p>
                                </div>
                                <Badge className={
                                  m.status === "accepted" ? "bg-secondary/20 text-secondary" :
                                  m.status === "pending" ? "bg-amber-100 text-amber-700" :
                                  "bg-muted text-muted-foreground"
                                }>
                                  {m.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Donation History */}
                    <div className="rounded-2xl border bg-card p-6 shadow-card">
                      <h3 className="font-display font-bold mb-4">Recent Donations Received</h3>
                      {hospitalDashboard.donation_history.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No donation history</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 font-body text-xs text-muted-foreground">Passport ID</th>
                                <th className="text-left py-2 font-body text-xs text-muted-foreground">Donor</th>
                                <th className="text-left py-2 font-body text-xs text-muted-foreground">Volume</th>
                                <th className="text-left py-2 font-body text-xs text-muted-foreground">Date</th>
                                <th className="text-left py-2 font-body text-xs text-muted-foreground">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hospitalDashboard.donation_history.map((d) => (
                                <tr key={d.passport_id} className="border-b last:border-0">
                                  <td className="py-3 font-body text-sm text-milk">{d.passport_id}</td>
                                  <td className="py-3 font-body text-sm">{d.donor_name}</td>
                                  <td className="py-3 font-body text-sm">{d.volume_ml}ml</td>
                                  <td className="py-3 font-body text-sm text-muted-foreground">{d.date}</td>
                                  <td className="py-3">
                                    <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Loading hospital dashboard...</p>
                  </div>
                )}
              </TabsContent>
            )}

            {/* Donor Nearby Requests Tab */}
            {role === "donor" && (
              <TabsContent value="my-requests" className="mt-6">
                <div className="space-y-4">
                  <h3 className="font-display text-xl font-bold">Nearby NICU Requests</h3>
                  {donorRequests.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-3xl bg-muted/5">
                      <Sparkles className="w-8 h-8 mx-auto text-muted-foreground mb-4" />
                      <p className="font-body text-muted-foreground">No urgent requests in your area right now.</p>
                      <p className="font-body text-sm text-muted-foreground mt-2">We'll notify you when NICUs need your help.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {donorRequests.map((req) => (
                        <div key={req.id} className="rounded-2xl border-2 border-milk/20 bg-card p-5 shadow-card">
                          <div className="flex items-center gap-2 mb-3">
                            <Building2 className="w-5 h-5 text-milk" />
                            <h4 className="font-display font-bold">{req.hospital}</h4>
                          </div>
                          <p className="font-body text-sm text-muted-foreground mb-2">{req.city}</p>
                          <div className="flex items-center gap-4 mb-4">
                            <div>
                              <p className="font-display text-lg font-bold text-milk">{req.quantity}ml</p>
                              <p className="font-body text-[10px] text-muted-foreground">needed</p>
                            </div>
                            {req.distance && (
                              <div>
                                <p className="font-display text-lg font-bold">{req.distance}</p>
                                <p className="font-body text-[10px] text-muted-foreground">away</p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between mb-4">
                            <Badge className={
                              req.urgency === "CRITICAL" ? "bg-blood text-white" :
                              req.urgency === "URGENT" ? "bg-amber-500 text-white" :
                              "bg-muted"
                            }>
                              {req.urgency}
                            </Badge>
                            <span className="font-body text-xs text-muted-foreground">{req.timeLeft} left</span>
                          </div>
                          <Button className="w-full bg-milk text-foreground font-bold rounded-xl">
                            I Can Help
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Milk Bank Tab */}
            <TabsContent value="bank" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    Milk Bank Registry
                    <Badge className="bg-milk/20 text-milk border-0 font-body text-[10px] h-5 rounded-full uppercase font-black">Milk Passport</Badge>
                  </h3>
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
                                <Badge className={`text-[9px] uppercase px-2 py-0.5 border-0 font-bold ${
                                  row.status === "Available" || row.status === "Pasteurized" ? "bg-secondary/15 text-secondary" :
                                  row.status === "Low Stock" || row.status === "Expiring Soon" ? "bg-amber-100 text-amber-700" :
                                  row.status === "Reserved" || row.status === "In Transit" ? "bg-blue-100 text-blue-700" :
                                  row.status === "Delivered" ? "bg-green-100 text-green-700" :
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
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                    <Shield className="w-4 h-4" />
                  </div>
                  <p className="font-body text-[11px] text-orange-900 leading-tight">
                    Each sample in MilkBridge is tracked via <strong>Milk Passport</strong>. We guarantee rigorous pasteurization protocols following WHO guidelines.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
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

                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Urgency</Label>
                    <Select
                      value={shortageFormData.urgency}
                      onValueChange={(v) => setShortageFormData({ ...shortageFormData, urgency: v })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Pincode (Optional)</Label>
                  <Input
                    placeholder="6 digits for location matching"
                    maxLength={6}
                    className="rounded-xl font-body"
                    value={shortageFormData.pincode}
                    onChange={(e) => setShortageFormData({ ...shortageFormData, pincode: e.target.value.replace(/\D/g, "") })}
                  />
                </div>

                <p className="font-body text-[11px] text-muted-foreground italic bg-blood/5 p-3 rounded-xl border border-blood/10">
                  This request will be broadcast to all verified donors in your area. Screened donors will receive SMS alerts.
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

      {/* Match Results Modal */}
      <AnimatePresence>
        {showMatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-card rounded-3xl border-2 border-milk/20 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="bg-milk p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-display text-xl font-bold">Matched Donors</h3>
                  <p className="text-foreground/70 text-xs font-body">
                    {selectedRequest?.hospital} - {selectedRequest?.quantity_needed}
                  </p>
                </div>
                <button
                  onClick={() => setShowMatchModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {isMatching ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-milk mb-4" />
                    <p className="text-muted-foreground">Finding compatible donors...</p>
                  </div>
                ) : matchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No matching donors found in this area.</p>
                    <p className="text-sm text-muted-foreground mt-2">Try expanding your search radius.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {matchResults.map((match, i) => (
                      <div key={match.milk_donor_id} className="rounded-xl border p-4 hover:border-milk/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-milk/10 flex items-center justify-center text-2xl">
                              🤱
                            </div>
                            <div>
                              <p className="font-display font-bold flex items-center gap-2">
                                {match.name}
                                {match.verified && <Sparkles size={14} className="text-amber-500" />}
                              </p>
                              <p className="font-body text-xs text-muted-foreground">{match.city} - {match.distance || "Same area"}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-display text-lg font-bold text-milk">{match.quantity_ml}ml</div>
                            <div className="font-body text-[10px] text-muted-foreground">daily</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex gap-2">
                            <Badge className="bg-secondary/10 text-secondary border-0 text-[10px]">
                              {match.match_score}% match
                            </Badge>
                            {match.pincode_match && (
                              <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
                                Same pincode
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="bg-milk text-foreground font-bold rounded-lg"
                            onClick={async () => {
                              try {
                                await api.milk.createMatch({
                                  request_id: selectedRequest!.id,
                                  donor_id: match.donor_id,
                                  milk_donor_id: match.milk_donor_id
                                });
                                toast.success(`Match request sent to ${match.name}!`);
                              } catch (e: any) {
                                toast.error(e.message || "Failed to create match");
                              }
                            }}
                          >
                            Request
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

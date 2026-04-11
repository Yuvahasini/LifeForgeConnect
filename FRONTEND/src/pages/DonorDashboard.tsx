import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Heart, MapPin, CheckCircle2, AlertCircle, Clock,
    Activity, Plus, Shield, Star, Loader2, ArrowRight,
    Droplets, Timer, Baby, Dna, HeartPulse, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/AuthContext";
import { api, getCurrentUserId, BloodRequest } from "@/lib/api";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONFIG — one entry per donor_type
// ─────────────────────────────────────────────────────────────────────────────
const MODULE_CONFIG: Record<string, {
    key: string;
    label: string;
    emoji: string;
    path: string;
    color: string;        // tailwind text color
    bg: string;           // tailwind bg color
    border: string;       // tailwind border color
    gradient: string;     // hero gradient
    description: string;
    genderRestricted?: "male" | "female";
}> = {
    blood: {
        key: "blood",
        label: "Blood Donation",
        emoji: "🩸",
        path: "/blood-bridge",
        color: "text-blood",
        bg: "bg-blood/10",
        border: "border-blood/30",
        gradient: "from-red-600 to-rose-700",
        description: "Match with patients who urgently need your blood type.",
    },
    platelet: {
        key: "platelet",
        label: "Platelet Donation",
        emoji: "⏱️",
        path: "/platelet-alert",
        color: "text-platelet",
        bg: "bg-platelet/10",
        border: "border-platelet/30",
        gradient: "from-amber-500 to-orange-600",
        description: "5-day viability window. Cancer patients depend on you.",
    },
    milk: {
        key: "milk",
        label: "Milk Donation",
        emoji: "🍼",
        path: "/milk-bridge",
        color: "text-milk",
        bg: "bg-milk/10",
        border: "border-milk/30",
        gradient: "from-pink-400 to-rose-500",
        description: "Donate breast milk to save premature infants in NICUs.",
        genderRestricted: "female",
    },
    marrow: {
        key: "marrow",
        label: "Bone Marrow",
        emoji: "🧬",
        path: "/marrow-match",
        color: "text-marrow",
        bg: "bg-marrow/10",
        border: "border-marrow/30",
        gradient: "from-violet-600 to-purple-700",
        description: "HLA-compatible marrow donation — a second chance at life.",
    },
    organ: {
        key: "organ",
        label: "Organ Donation",
        emoji: "🫁",
        path: "/last-gift",
        color: "text-organ",
        bg: "bg-organ/10",
        border: "border-organ/30",
        gradient: "from-teal-500 to-emerald-600",
        description: "Pledge your organs and give recipients a life-saving gift.",
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK donation history (replace with real API call later)
// ─────────────────────────────────────────────────────────────────────────────
const mockHistory = [
    { date: "Feb 15, 2025", type: "🩸 Blood", hospital: "Lilavati Hospital", status: "Fulfilled", impact: "3 lives saved" },
    { date: "Jan 28, 2025", type: "⏱️ Platelets", hospital: "Kokilaben Hospital", status: "Fulfilled", impact: "1 patient helped" },
    { date: "Jan 10, 2025", type: "🩸 Blood", hospital: "Breach Candy Hospital", status: "Fulfilled", impact: "2 lives saved" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CARD — shown in the "Your Donation Modules" grid
// ─────────────────────────────────────────────────────────────────────────────
function ModuleCard({ mod, index }: { mod: typeof MODULE_CONFIG[string]; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
        >
            <Link to={mod.path}>
                <div className={`group rounded-2xl border-2 ${mod.border} bg-card p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-xl ${mod.bg} flex items-center justify-center text-2xl`}>
                            {mod.emoji}
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all mt-1" />
                    </div>
                    <div className={`font-display font-bold text-base text-foreground mb-0.5`}>{mod.label}</div>
                    <p className="font-body text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
                    {mod.genderRestricted && (
                        <Badge className="mt-2 text-[10px] bg-pink-100 text-pink-700 border-0 font-body">
                            {mod.genderRestricted === "female" ? "Women donors" : "Men donors"}
                        </Badge>
                    )}
                </div>
            </Link>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOOD MODULE PANEL — inline urgent requests for blood donors
// ─────────────────────────────────────────────────────────────────────────────
function BloodModulePanel() {
    const [requests, setRequests] = useState<BloodRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const id = getCurrentUserId();
        if (!id) { setLoading(false); return; }
        api.blood.getRequestsForDonor(id)
            .then(setRequests)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="rounded-2xl border-2 border-blood/20 bg-card overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-rose-700 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🩸</span>
                    <div>
                        <div className="font-display font-bold text-white text-base">Blood Donation</div>
                        <div className="font-body text-white/70 text-xs">Urgent requests matching your blood type</div>
                    </div>
                </div>
                <Link to="/blood-bridge">
                    <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 font-body text-xs rounded-lg">
                        View All <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                </Link>
            </div>
            <div className="p-4">
                {loading ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blood" /></div>
                ) : requests.length === 0 ? (
                    <div className="text-center py-6">
                        <Heart className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                        <p className="font-body text-sm text-muted-foreground">No urgent requests right now.</p>
                        <p className="font-body text-xs text-muted-foreground mt-1">We'll alert you when someone needs your blood type.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {requests.slice(0, 3).map((req, i) => (
                            <motion.div key={req.id || i}
                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                                className="rounded-xl border border-blood/20 bg-blood/3 p-3 flex items-center gap-3"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blood/10 flex items-center justify-center font-display font-bold text-blood text-sm shrink-0">
                                    {req.group}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-body font-bold text-sm text-foreground truncate">{req.hospital}</div>
                                    <div className="font-body text-xs text-muted-foreground flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />{req.city} · <Clock className="w-3 h-3" />{req.posted}
                                    </div>
                                </div>
                                <Badge className={`text-[10px] border-0 font-body shrink-0 ${req.urgency === "CRITICAL" ? "bg-blood/15 text-blood" : "bg-platelet/15 text-platelet"}`}>
                                    {req.urgency}
                                </Badge>
                                <Button size="sm" onClick={() => toast.success(`Response sent to ${req.hospital}!`)}
                                    className="bg-blood text-white font-body font-semibold rounded-lg text-xs px-3 h-8 shrink-0">
                                    Respond
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATELET MODULE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function PlateletModulePanel() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const userId = getCurrentUserId();

    useEffect(() => {
        api.platelet.getOpenRequests({ user_id: userId || undefined })
            .then((r) => setRequests(r.slice(0, 3)))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="rounded-2xl border-2 border-platelet/20 bg-card overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">⏱️</span>
                    <div>
                        <div className="font-display font-bold text-white text-base">Platelet Donation</div>
                        <div className="font-body text-white/70 text-xs">Cancer patients with expiring windows</div>
                    </div>
                </div>
                <Link to="/platelet-alert">
                    <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 font-body text-xs rounded-lg">
                        View All <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                </Link>
            </div>
            <div className="p-4">
                {loading ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-platelet" /></div>
                ) : requests.length === 0 ? (
                    <div className="text-center py-6">
                        <Timer className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                        <p className="font-body text-sm text-muted-foreground">No urgent platelet requests right now.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {requests.map((req, i) => (
                            <motion.div key={req.id || i}
                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                                className="rounded-xl border border-platelet/20 bg-platelet/3 p-3 flex items-center gap-3"
                            >
                                <div className="w-10 h-10 rounded-lg bg-platelet/10 flex items-center justify-center font-display font-bold text-platelet text-sm shrink-0">
                                    {req.group}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-body font-bold text-sm text-foreground truncate">{req.patient}</div>
                                    <div className="font-body text-xs text-muted-foreground">{req.cancer} · {req.hospital}</div>
                                    <div className={`font-body text-[11px] font-bold mt-0.5 ${req.is_critical ? "text-blood" : "text-platelet"}`}>
                                        ⏰ {req.expiry} remaining
                                    </div>
                                </div>
                                <Badge className={`text-[10px] border-0 font-body shrink-0 ${req.is_critical ? "bg-blood/15 text-blood" : "bg-platelet/15 text-platelet"}`}>
                                    {req.urgency}
                                </Badge>
                                <Button size="sm"
                                    onClick={async () => {
                                        try {
                                            await api.platelet.createMatch({ request_id: req.id, donor_id: userId! });
                                            toast.success("Donation intent recorded!");
                                        } catch (e: any) { toast.error(e.message); }
                                    }}
                                    className="bg-platelet text-white font-body font-semibold rounded-lg text-xs px-3 h-8 shrink-0">
                                    Donate
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE PANEL — for milk, marrow, organ (navigate to module page)
// ─────────────────────────────────────────────────────────────────────────────
function SimpleModulePanel({ modKey }: { modKey: string }) {
    const mod = MODULE_CONFIG[modKey];
    if (!mod) return null;

    const tips: Record<string, string[]> = {
        milk: [
            "Pump or hand-express milk within 6 hours of feeding",
            "Store in sterile containers and keep refrigerated",
            "Milk bank will arrange pickup from your location",
        ],
        marrow: [
            "Marrow donation is a one-time process for a specific patient",
            "HLA typing takes 2–4 weeks — stay available",
            "Recovery time is typically 2–3 weeks",
        ],
        organ: [
            "Your pledge is documented — family will be informed",
            "Organs can save up to 8 lives after death",
            "You can update or revoke your pledge anytime",
        ],
    };

    return (
        <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: `var(--${modKey}, #ccc)` }}
            className={`rounded-2xl border-2 ${mod.border} bg-card overflow-hidden`}
        >
            <div className={`bg-gradient-to-r ${mod.gradient} px-5 py-4 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{mod.emoji}</span>
                    <div>
                        <div className="font-display font-bold text-white text-base">{mod.label}</div>
                        <div className="font-body text-white/70 text-xs">{mod.description}</div>
                    </div>
                </div>
                <Link to={mod.path}>
                    <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 font-body text-xs rounded-lg">
                        Open Module <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                </Link>
            </div>
            <div className="p-4">
                <p className="font-body text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Quick Tips</p>
                <div className="space-y-2">
                    {(tips[modKey] || []).map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${mod.color}`} />
                            <p className="font-body text-xs text-muted-foreground">{tip}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DONOR DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export function DonorDashboard() {
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

    // Build the list of active modules for this donor
    const activeModules = Object.values(MODULE_CONFIG).filter(m => donorTypes.includes(m.key));

    // Default active module to first one
    useEffect(() => {
        if (activeModules.length > 0 && !activeModule) {
            setActiveModule(activeModules[0].key);
        }
    }, [donorTypes]);

    const currentMod = activeModule ? MODULE_CONFIG[activeModule] : null;

    return (
        <div className="space-y-6">

            {/* ── Profile Hero Card ── */}
            <div className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
                <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary-foreground/20 flex items-center justify-center text-3xl font-bold font-display shrink-0">
                        {initial}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-display text-2xl font-bold">{name}</h2>
                            {isVerified && (
                                <Badge className="bg-accent/20 text-accent border-0 font-body text-xs">
                                    <Shield className="w-3 h-3 mr-1" /> Verified
                                </Badge>
                            )}
                        </div>
                        {/* Show all donor type badges */}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {activeModules.map(m => (
                                <span key={m.key} className="inline-flex items-center gap-1 bg-primary-foreground/15 text-primary-foreground/90 text-[11px] font-body font-semibold px-2 py-0.5 rounded-full">
                                    {m.emoji} {m.label}
                                </span>
                            ))}
                            {activeModules.length === 0 && (
                                <span className="font-body text-primary-foreground/60 text-sm">No donation types registered yet</span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-accent fill-current" />
                                <span className="font-body text-sm font-bold">{trustScore} Trust Score</span>
                            </div>
                            <span className="font-body text-sm text-primary-foreground/60">{city}</span>
                        </div>
                    </div>
                    {/* Availability toggle */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="font-body text-sm font-medium text-primary-foreground/80">Available</span>
                        <button
                            onClick={() => setAvailable(!available)}
                            className={`w-12 h-6 rounded-full transition-all duration-300 relative ${available ? "bg-accent" : "bg-primary-foreground/30"}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-primary-foreground transition-all duration-300 ${available ? "right-1" : "left-1"}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Stats Row ── */}
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

            {/* ── No modules registered ── */}
            {activeModules.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-10 text-center">
                    <div className="text-4xl mb-3">🎗️</div>
                    <h3 className="font-display text-lg font-bold text-foreground mb-2">No donation types registered</h3>
                    <p className="font-body text-sm text-muted-foreground mb-4">
                        It looks like your profile doesn't have any donor types set yet. Contact support or re-register to add your donation preferences.
                    </p>
                </div>
            )}

            {/* ── Module Tab Selector ── */}
            {activeModules.length > 1 && (
                <div>
                    <p className="font-body text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                        Your Donation Modules
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {activeModules.map(mod => (
                            <button
                                key={mod.key}
                                onClick={() => setActiveModule(mod.key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-body font-bold text-sm transition-all border-2 ${activeModule === mod.key
                                        ? `${mod.bg} ${mod.border} ${mod.color} shadow-sm`
                                        : "border-border bg-card text-muted-foreground hover:border-border/80"
                                    }`}
                            >
                                <span>{mod.emoji}</span>
                                <span>{mod.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Active Module Panel ── */}
            <AnimatePresence mode="wait">
                {activeModule && (
                    <motion.div
                        key={activeModule}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeModule === "blood" && <BloodModulePanel />}
                        {activeModule === "platelet" && <PlateletModulePanel />}
                        {(activeModule === "milk" || activeModule === "marrow" || activeModule === "organ") && (
                            <SimpleModulePanel modKey={activeModule} />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── All modules overview grid (shown when donor has 2+ types) ── */}
            {activeModules.length > 1 && (
                <div>
                    <p className="font-body text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                        Quick Access
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeModules.map((mod, i) => (
                            <ModuleCard key={mod.key} mod={mod} index={i} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Donation History ── */}
            <div>
                <h3 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-secondary" /> Donation History
                </h3>
                <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted">
                            <tr>
                                {["Date", "Type", "Hospital", "Status", "Impact"].map(h => (
                                    <th key={h} className="font-body text-xs font-semibold text-muted-foreground px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {mockHistory.map((row, i) => (
                                <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                                    <td className="font-body text-sm px-4 py-3 text-muted-foreground">{row.date}</td>
                                    <td className="font-body text-sm px-4 py-3 font-medium">{row.type}</td>
                                    <td className="font-body text-sm px-4 py-3 text-muted-foreground">{row.hospital}</td>
                                    <td className="px-4 py-3">
                                        <Badge className="bg-secondary/15 text-secondary border-0 font-body text-xs">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> {row.status}
                                        </Badge>
                                    </td>
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
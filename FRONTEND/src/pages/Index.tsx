import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LiveCounter from "@/components/LiveCounter";
import ModuleCard from "@/components/ModuleCard";
import heroBg from "@/assets/hero-bg.jpg";
import { useAuth } from "@/hooks/AuthContext";
import { toast } from "sonner";

const modules = [
  {
    emoji: "🩸",
    name: "BloodBridge",
    tagline: "Real-time blood matching",
    description: "Instant blood group matching with nearby verified donors. Smart shortage prediction and urgency-based alerts for hospitals.",
    path: "/blood-bridge",
    color: "text-blood",
    bgColor: "bg-blood",
    borderColor: "border-blood/20",
    stats: "2.3M donors",
  },
  {
    emoji: "💉",
    name: "ThalCare",
    tagline: "Recurring transfusion support",
    description: "Dedicated donor matching for Thalassemia patients. Automated scheduling, transfusion calendars, and 7-day advance alerts.",
    path: "/thal-care",
    color: "text-thal",
    bgColor: "bg-thal",
    borderColor: "border-thal/20",
    stats: "4.2L patients",
  },
  {
    emoji: "⏱️",
    name: "PlateletAlert",
    tagline: "5-day expiry, zero waste",
    description: "Cancer patient platelet matching with 5-day viability tracking. Compatible score beyond blood group. Apheresis calendar.",
    path: "/platelet-alert",
    color: "text-platelet",
    bgColor: "bg-platelet",
    borderColor: "border-platelet/20",
    stats: "48hr match",
  },
  {
    emoji: "🧬",
    name: "MarrowMatch",
    tagline: "HLA precision matching",
    description: "Instant HLA similarity scoring for bone marrow transplants. Anonymized donor-patient journey with confidence percentage.",
    path: "/marrow-match",
    color: "text-marrow",
    bgColor: "bg-marrow",
    borderColor: "border-marrow/20",
    stats: "94% accuracy",
  },
  {
    emoji: "🫁",
    name: "LastGift",
    tagline: "Organ donation, dignified",
    description: "Digital organ pledge with family OTP consent. Brain-death protocol integration, viability window timers, and ranked recipient matching.",
    path: "/last-gift",
    color: "text-organ",
    bgColor: "bg-organ",
    borderColor: "border-organ/20",
    stats: "6 organ types",
  },
  {
    emoji: "🍼",
    name: "MilkBridge",
    tagline: "Nourishing premature lives",
    description: "Connecting lactating mothers with NICUs and orphanages. Milk Passport QR system, pasteurization tracking, and impact stories.",
    path: "/milk-bridge",
    color: "text-milk",
    bgColor: "bg-milk",
    borderColor: "border-milk/20",
    stats: "27M babies",
  },
];

const steps = [
  {
    icon: "📋",
    step: "01",
    title: "Register & Verify",
    description: "Sign up with Aadhaar + Mobile OTP. Upload medical documents for instant verification. Get your Trust Score badge.",
    color: "text-blood",
  },
  {
    icon: "🤖",
    step: "02",
    title: "Smart Match",
    description: "Our AI engine matches donors with patients based on blood group, HLA type, location proximity, availability, and urgency score.",
    color: "text-secondary",
  },
  {
    icon: "🤝",
    step: "03",
    title: "Connect & Save",
    description: "Receive real-time alerts. Connect via secure in-app messaging. Coordinate with hospitals. Log your donation and earn trust points.",
    color: "text-accent",
  },
];

const partners = [
  "AIIMS Delhi", "Tata Memorial", "Apollo Hospitals", "NOTTO", "NACO",
  "Red Cross India", "Rotary Blood Bank", "iBlood"
];

export default function Index() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const handleFindDonors = () => {
    if (!role) {
      toast.error("Please log in to continue", {
        description: "You need to be logged in to find donors.",
        action: {
          label: "Login",
          onClick: () => navigate("/login"),
        },
      });
      return;
    }
    navigate("/blood-bridge");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src={heroBg}
            alt="LifeForge Connect - Connecting donors with patients"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/85 via-foreground/70 to-primary/60" />
        </div>

        {/* Decorative elements */}
        <div className="absolute top-24 right-10 w-64 h-64 rounded-full bg-primary/10 blur-3xl animate-float" />
        <div className="absolute bottom-16 left-10 w-48 h-48 rounded-full bg-accent/15 blur-3xl animate-float" style={{ animationDelay: "2s" }} />

        <div className="container mx-auto px-4 relative pt-24 pb-16">
          <div className="max-w-3xl">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="font-body text-sm font-semibold text-primary-foreground">
                India's #1 Life-Saving Donation Platform
              </span>
            </motion.div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-5xl md:text-7xl font-black text-primary-foreground leading-[1.05] mb-5"
            >
              Connect.
              <span className="block gradient-text-amber">Save Lives.</span>
              Instantly.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="font-body text-lg md:text-xl text-primary-foreground/80 leading-relaxed max-w-xl mb-8"
            >
              Blood · Platelets · Bone Marrow · Plasma · Organs · Mother's Milk.
              <br />
              Six modules. One platform. Zero delays. <strong className="text-accent">Thousands saved daily.</strong>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              {/* Find Donors Now — requires login */}
              <Button
                size="lg"
                onClick={handleFindDonors}
                className="font-body font-bold text-base px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary-lg rounded-xl"
              >
                Find Donors Now <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
              <Link to="/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-body font-bold text-base px-8 py-6 border-2 border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground/10 rounded-xl"
                >
                  Register to Donate
                </Button>
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap gap-5 mt-10"
            >
              {[
                { icon: <CheckCircle2 className="w-4 h-4" />, label: "Aadhaar Verified" },
                { icon: <Users className="w-4 h-4" />, label: "12L+ Active Donors" },
                { icon: <Zap className="w-4 h-4" />, label: "< 5 min Matching" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-primary-foreground/80">
                  <span className="text-accent">{icon}</span>
                  <span className="font-body text-sm font-medium">{label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <div className="w-5 h-8 rounded-full border-2 border-primary-foreground/40 flex items-start justify-center p-1">
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-2 bg-primary-foreground/60 rounded-full"
            />
          </div>
        </div>
      </section>

      {/* ── LIVE COUNTERS ── */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-1.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-body text-sm font-semibold text-primary">Live Platform Stats</span>
            </div>
            <h2 className="font-display text-3xl font-bold text-foreground">Real Impact. Real Time.</h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <LiveCounter icon="🩸" end={2847} label="Matches Today" suffix="+" color="text-blood" />
            <LiveCounter icon="❤️" end={142650} label="Lives Impacted" suffix="+" color="text-primary" duration={2.5} />
            <LiveCounter icon="🟢" end={18423} label="Active Donors Online" color="text-secondary" />
            <LiveCounter icon="🏥" end={1284} label="Hospitals Connected" color="text-organ" />
          </div>
        </div>
      </section>

      {/* ── MODULE CARDS ── */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Six Modules,{" "}
              <span className="gradient-text">One Mission</span>
            </h2>
            <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto">
              From emergency blood requests to neonatal milk banks — every life-saving need, covered by a dedicated intelligent module.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((mod, i) => (
              <ModuleCard key={mod.name} {...mod} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 bg-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-accent blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              How It <span className="gradient-text-amber">Works</span>
            </h2>
            <p className="font-body text-lg text-primary-foreground/60 max-w-xl mx-auto">
              Three simple steps. Life-changing impact.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary via-secondary to-accent opacity-30" />

            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center text-4xl mx-auto">
                    {step.icon}
                  </div>
                  <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center`}>
                    <span className="font-body text-xs font-black text-primary-foreground">{step.step}</span>
                  </div>
                </div>
                <h3 className={`font-display text-xl font-bold text-primary-foreground mb-3`}>{step.title}</h3>
                <p className="font-body text-sm text-primary-foreground/60 leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-14"
          >
            <Link to="/register">
              <Button
                size="lg"
                className="font-body font-bold text-base px-10 py-6 bg-gradient-primary text-primary-foreground shadow-primary-lg rounded-xl hover:opacity-90"
              >
                Start Saving Lives Today <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── URGENCY BANNER ── */}
      <section className="py-16 bg-primary/8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { stat: "5 lakh+", label: "Need bone marrow annually", icon: "🧬" },
              { stat: "4.2 lakh", label: "Thalassemia patients in India", icon: "💉" },
              { stat: "27 million", label: "Premature babies need donor milk", icon: "🍼" },
              { stat: "< 6 hrs", label: "Heart viability window", icon: "❤️" },
            ].map(({ stat, label, icon }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="p-5"
              >
                <div className="text-3xl mb-2">{icon}</div>
                <div className="font-display text-2xl md:text-3xl font-black text-primary mb-1">{stat}</div>
                <div className="font-body text-xs text-muted-foreground font-medium">{label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTNERS ── */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h3 className="font-body text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Trusted By
            </h3>
            <h2 className="font-display text-3xl font-bold text-foreground">India's Leading Healthcare Partners</h2>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-4">
            {partners.map((partner, i) => (
              <motion.div
                key={partner}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="px-6 py-3 rounded-xl border-2 border-border bg-card shadow-card font-body text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-all duration-200 cursor-pointer"
              >
                {partner}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-gradient-hero p-12 md:p-16 text-center relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent/15 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-primary-foreground/5 blur-3xl" />
            <div className="relative">
              <div className="text-5xl mb-4">❤️</div>
              <h2 className="font-display text-4xl md:text-5xl font-black text-primary-foreground mb-4">
                Every Second Counts.
              </h2>
              <p className="font-body text-lg text-primary-foreground/80 max-w-xl mx-auto mb-8">
                Join 12 lakh+ donors who have already made a difference. Your single act can save up to 8 lives.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register">
                  <Button
                    size="lg"
                    className="font-body font-bold text-base px-10 py-6 bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-xl shadow-lg"
                  >
                    Register as Donor
                  </Button>
                </Link>
                <Link to="/register?type=hospital">
                  <Button
                    size="lg"
                    variant="outline"
                    className="font-body font-bold text-base px-10 py-6 border-2 border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10 rounded-xl"
                  >
                    Register Hospital
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
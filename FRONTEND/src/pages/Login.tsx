import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/AuthContext";
import { api } from "@/lib/api";

type Mode = "donor" | "hospital" | "admin";

const loginOrgTypes = [
  { id: "hospital", label: "Hospital", emoji: "🏥" },
  { id: "bloodbank", label: "Blood Bank", emoji: "🩸" },
  { id: "orphanage", label: "Orphanage", emoji: "🏠" },
  { id: "ngo", label: "NGO / Foundation", emoji: "🤝" },
];

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState<Mode>("donor");
  const [orgType, setOrgType] = useState("hospital");
  const [otpSent, setOtpSent] = useState(false);
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (tab: string) => {
    setError("");
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const role = tab as Mode;
      const data = await api.auth.login(email, password, role);
      // data contains: { access_token, user_id, role, profile, redirect }
      const profile = data.profile || {};
      const userName = profile.name || email.split("@")[0];
      login(
        role,
        userName,
        role === "hospital" ? (orgType as any) : undefined,
        profile
      );
      navigate("/dashboard");
    } catch (e: any) {
      setError(e.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-1/2 bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-accent blur-3xl" />
          <div className="absolute bottom-20 left-20 w-48 h-48 rounded-full bg-primary-foreground blur-3xl" />
        </div>
        <div className="relative flex flex-col justify-between h-full p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary-foreground fill-current" />
            </div>
            <div>
              <div className="font-display font-bold text-xl text-primary-foreground">LifeForge</div>
              <div className="font-body text-xs text-accent font-bold tracking-widest uppercase -mt-1">Connect</div>
            </div>
          </Link>

          <div>
            <h2 className="font-display text-5xl font-black text-primary-foreground leading-tight mb-4">
              Welcome<br />Back, Hero.
            </h2>
            <p className="font-body text-primary-foreground/70 leading-relaxed mb-8">
              Thousands are waiting for a match right now. Log in and check if your donation can save a life today.
            </p>
            <div className="space-y-4">
              {[
                { icon: "🩸", text: "2,847 matches made today" },
                { icon: "🟢", text: "18,423 donors currently online" },
                { icon: "⚡", text: "Average match time: 4 minutes" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-primary-foreground/80">
                  <span className="text-xl">{icon}</span>
                  <span className="font-body text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="font-body text-xs text-primary-foreground/40">
            © 2025 LifeForge Connect · Securing lives across India
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 font-body text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary-foreground fill-current" />
              </div>
              <span className="font-display font-bold text-xl text-foreground">LifeForge Connect</span>
            </div>

            <h1 className="font-display text-3xl font-bold text-foreground mb-1">
              Login {mode === "admin" && "as Admin"}
            </h1>
            {mode !== "admin" && (
              <p className="font-body text-sm text-muted-foreground mb-7">
                Don't have an account?{" "}
                <Link to="/register" className="text-primary font-semibold hover:underline">
                  Register now
                </Link>
              </p>
            )}

            <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setError(""); }} className="mb-6 mt-4">
              {mode !== "admin" && (
                <TabsList className="w-full grid grid-cols-2 bg-muted rounded-xl h-11">
                  <TabsTrigger value="donor" className="rounded-lg font-body font-semibold text-sm">
                    Donor
                  </TabsTrigger>
                  <TabsTrigger value="hospital" className="rounded-lg font-body font-semibold text-sm">
                    Hospital / Org
                  </TabsTrigger>
                </TabsList>
              )}

              {["donor", "hospital", "admin"].map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-6 space-y-4">
                  {/* Organization Type Selector for Hospital Login */}
                  {tab === "hospital" && (
                    <div className="space-y-2 mb-4">
                      <Label className="font-body font-semibold text-sm">Organization Type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {loginOrgTypes.map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setOrgType(type.id)}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all font-body text-xs font-semibold ${orgType === type.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                              }`}
                          >
                            <span>{type.emoji}</span>
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mobile OTP section */}
                  {tab === "donor" && (
                    <>
                      <div className="space-y-2">
                        <Label className="font-body font-semibold text-sm text-foreground">Mobile Number</Label>
                        <div className="flex gap-2">
                          <Input
                            type="tel"
                            placeholder="+91 98765 43210"
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value)}
                            className="font-body flex-1 h-11 rounded-xl border-border focus:border-primary"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOtpSent(true)}
                            className="h-11 px-4 border-primary text-primary font-body font-semibold hover:bg-primary hover:text-primary-foreground rounded-xl"
                          >
                            {otpSent ? "Resend" : "Get OTP"}
                          </Button>
                        </div>
                      </div>

                      {otpSent && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-2"
                        >
                          <Label className="font-body font-semibold text-sm text-foreground">Enter OTP</Label>
                          <Input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit OTP"
                            className="font-body h-11 rounded-xl border-border focus:border-primary tracking-[0.3em] text-center text-lg"
                          />
                          {otpSent && (
                            <p className="font-body text-xs text-secondary flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> OTP sent to {mobile || "+91 XXXXX XXXXX"}
                            </p>
                          )}
                        </motion.div>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="font-body text-xs text-muted-foreground font-medium">or login with email</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label className="font-body font-semibold text-sm">
                      {tab === "hospital" ? "Official Email" : "Email Address"}
                    </Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="font-body h-11 rounded-xl border-border focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="font-body font-semibold text-sm">Password</Label>
                      <a href="#" className="font-body text-xs text-primary hover:underline">Forgot password?</a>
                    </div>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="font-body h-11 rounded-xl border-border focus:border-primary pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="font-body text-sm text-blood font-semibold">{error}</p>
                  )}

                  <Button
                    onClick={() => handleLogin(tab)}
                    disabled={loading}
                    className="w-full h-12 font-body font-bold text-base bg-gradient-primary text-primary-foreground rounded-xl shadow-primary hover:opacity-90 mt-2"
                  >
                    {loading ? "Logging in..." : `Login as ${tab === "hospital"
                      ? loginOrgTypes.find(o => o.id === orgType)?.label
                      : tab.charAt(0).toUpperCase() + tab.slice(1)
                      }`}
                  </Button>
                </TabsContent>
              ))}
            </Tabs>

            <p className="font-body text-xs text-muted-foreground text-center mt-6">
              {mode === "admin" ? (
                <button
                  onClick={() => setMode("donor")}
                  className="text-primary font-semibold hover:underline"
                >
                  Back to User login
                </button>
              ) : (
                <button
                  onClick={() => setMode("admin")}
                  className="text-primary font-medium hover:underline opacity-60 hover:opacity-100 transition-opacity"
                >
                  Administrator Login
                </button>
              )}
            </p>

            <p className="font-body text-xs text-muted-foreground text-center mt-4">
              By logging in, you agree to our{" "}
              <a href="#" className="text-primary hover:underline">Terms</a> &{" "}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, ArrowLeft, CheckCircle2, Eye, EyeOff, ChevronRight, ChevronLeft } from "lucide-react";
import FileUploadZone from "@/components/FileUploadZone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/AuthContext";

const donorTypes = [
  { id: "blood", label: "Blood", emoji: "🩸" },
  { id: "platelet", label: "Platelets", emoji: "⏱️" },
  { id: "marrow", label: "Bone Marrow", emoji: "🧬" },
  { id: "plasma", label: "Plasma", emoji: "🧪" },
  { id: "organ", label: "Organ", emoji: "🫁" },
  { id: "milk", label: "Breast Milk", emoji: "🍼", womenOnly: true },
];

const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function DonorRegister() {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [showPass, setShowPass] = useState(false);
  const [bloodGroup, setBloodGroup] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [dob, setDob] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const toggleType = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setError("");
    if (password !== confirmPass) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await api.auth.registerDonor({
        first_name: firstName,
        last_name: lastName,
        mobile,
        aadhaar: aadhaar || undefined,
        dob: dob || undefined,
        gender: gender || undefined,
        city,
        pincode: pincode || undefined,
        blood_group: bloodGroup,
        donor_types: selected,
        email,
        password,
      });
      login("donor", firstName || "Donor", undefined, { donor_types: selected });
      navigate("/dashboard");
    } catch (e: any) {
      setError(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${s <= step ? "bg-gradient-primary" : "bg-muted"
              }`}
          />
        ))}
      </div>

      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="font-display text-xl font-bold text-foreground">Personal Details</h3>
            <p className="font-body text-sm text-muted-foreground">Step 1 of 3</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-sm">First Name</Label>
              <Input placeholder="Arjun" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11 rounded-xl font-body" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-sm">Last Name</Label>
              <Input placeholder="Sharma" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11 rounded-xl font-body" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-body font-semibold text-sm">Mobile Number</Label>
            <div className="flex gap-2">
              <Input type="tel" placeholder="+91 98765 43210" value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-11 rounded-xl font-body flex-1" />
              <Button
                variant="outline"
                onClick={() => setOtpSent(true)}
                className="h-11 border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-xl font-body"
              >
                {otpSent ? <CheckCircle2 className="w-4 h-4" /> : "OTP"}
              </Button>
            </div>
          </div>
          {otpSent && (
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-sm">Enter OTP</Label>
              <Input placeholder="6-digit OTP" maxLength={6} className="h-11 rounded-xl font-body tracking-[0.3em] text-center" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="font-body font-semibold text-sm">Aadhaar Number</Label>
            <Input placeholder="XXXX XXXX XXXX" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} className="h-11 rounded-xl font-body" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-sm">Date of Birth</Label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-11 rounded-xl font-body" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-sm">Gender</Label>
              <div className="flex gap-2">
                {["Male", "Female", "Other"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`flex-1 h-11 rounded-xl border-2 font-body text-xs font-semibold transition-all ${gender === g
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-sm">City</Label>
              <Input placeholder="Mumbai" value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded-xl font-body" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body font-semibold text-sm">PIN Code</Label>
              <Input placeholder="400001" value={pincode} onChange={(e) => setPincode(e.target.value)} className="h-11 rounded-xl font-body" />
            </div>
          </div>
          <Button
            onClick={() => setStep(2)}
            className="w-full h-12 bg-gradient-primary text-primary-foreground font-body font-bold rounded-xl shadow-primary"
          >
            Continue <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          <div className="text-center mb-4">
            <h3 className="font-display text-xl font-bold text-foreground">Donation Preferences</h3>
            <p className="font-body text-sm text-muted-foreground">Step 2 of 3 — Select what you'd like to donate</p>
          </div>

          {/* Blood group */}
          <div className="space-y-2">
            <Label className="font-body font-semibold text-sm">Blood Group</Label>
            <div className="grid grid-cols-4 gap-2">
              {bloodGroups.map((bg) => (
                <button
                  key={bg}
                  onClick={() => setBloodGroup(bg)}
                  className={`h-11 rounded-xl border-2 font-display font-bold text-sm transition-all ${bloodGroup === bg
                    ? "border-blood bg-blood/10 text-blood"
                    : "border-border text-muted-foreground hover:border-blood/30"
                    }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          {/* Donation types */}
          <div className="space-y-2">
            <Label className="font-body font-semibold text-sm">What would you like to donate?</Label>
            <div className="grid grid-cols-2 gap-2">
              {donorTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => toggleType(type.id)}
                  disabled={type.womenOnly && gender === "Male"}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${selected.includes(type.id)
                    ? "border-primary bg-primary/8 text-primary"
                    : "border-border hover:border-primary/30"
                    }`}
                >
                  <span className="text-xl">{type.emoji}</span>
                  <div>
                    <div className="font-body text-sm font-semibold text-foreground">{type.label}</div>
                    {type.womenOnly && (
                      <div className="font-body text-xs text-muted-foreground">Women only</div>
                    )}
                  </div>
                  {selected.includes(type.id) && (
                    <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ID Upload */}
          <div className="space-y-2">
            <Label className="font-body font-semibold text-sm">Upload Government ID</Label>
            <FileUploadZone
              accept="image/*,.pdf"
              maxSizeMB={5}
              hint="Aadhaar, PAN, Voter ID (max 5 MB)"
              accentClass="primary"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1 h-12 border-border font-body rounded-xl"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              className="flex-1 h-12 bg-gradient-primary text-primary-foreground font-body font-bold rounded-xl shadow-primary"
            >
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="font-display text-xl font-bold text-foreground">Create Account</h3>
            <p className="font-body text-sm text-muted-foreground">Step 3 of 3 — Almost there!</p>
          </div>
          <div className="space-y-1.5">
            <Label className="font-body font-semibold text-sm">Email Address</Label>
            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl font-body" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-body font-semibold text-sm">Password</Label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl font-body pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-body font-semibold text-sm">Confirm Password</Label>
            <Input type="password" placeholder="••••••••" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className="h-11 rounded-xl font-body" />
          </div>
          <div className="flex items-start gap-2 mt-2">
            <Checkbox id="terms" className="mt-0.5 border-primary data-[state=checked]:bg-primary" />
            <label htmlFor="terms" className="font-body text-xs text-muted-foreground leading-relaxed">
              I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a>,{" "}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>, and consent to sharing my anonymized data for matching purposes.
            </label>
          </div>
          {error && (
            <p className="font-body text-sm text-blood font-semibold">{error}</p>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 border-border font-body rounded-xl">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 h-12 bg-gradient-primary text-primary-foreground font-body font-bold rounded-xl shadow-primary"
            >
              {loading ? "Creating..." : "Create Account ✓"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

const orgTypes = [
  {
    id: "hospital",
    label: "Hospital",
    emoji: "🏥",
    nameLabel: "Hospital Name",
    namePlaceholder: "Apollo Hospitals, Mumbai",
    regLabel: "Registration Number",
    regPlaceholder: "MH/HOS/XXXX",
    licenseLabel: "License Number",
    licensePlaceholder: "Hospital License No.",
    docsHint: "Registration cert, License, NABH docs",
    contactLabel: "Contact Person",
    contactPlaceholder: "Dr. Priya Menon",
    emailPlaceholder: "admin@hospital.in",
    submitLabel: "Register Hospital",
  },
  {
    id: "bloodbank",
    label: "Blood Bank",
    emoji: "🩸",
    nameLabel: "Blood Bank Name",
    namePlaceholder: "City Blood Bank, Delhi",
    regLabel: "Registration Number",
    regPlaceholder: "BB/REG/XXXX",
    licenseLabel: "Blood Bank License",
    licensePlaceholder: "CDSCO License No.",
    docsHint: "CDSCO License, Registration cert, SOP docs",
    contactLabel: "In-charge Name",
    contactPlaceholder: "Dr. Ramesh Kumar",
    emailPlaceholder: "contact@bloodbank.in",
    submitLabel: "Register Blood Bank",
  },
  {
    id: "orphanage",
    label: "Orphanage",
    emoji: "🏠",
    nameLabel: "Orphanage Name",
    namePlaceholder: "Hope Children's Home, Pune",
    regLabel: "Trust/Society Reg. No.",
    regPlaceholder: "TR/XXXX/XXXX",
    licenseLabel: "CARA / State License",
    licensePlaceholder: "License Number",
    docsHint: "Trust deed, Registration cert, CARA approval",
    contactLabel: "Warden / In-charge",
    contactPlaceholder: "Mrs. Sunita Rao",
    emailPlaceholder: "warden@orphanage.org",
    submitLabel: "Register Orphanage",
  },
  {
    id: "ngo",
    label: "NGO / Foundation",
    emoji: "🤝",
    nameLabel: "NGO / Foundation Name",
    namePlaceholder: "Helping Hands Foundation",
    regLabel: "NGO / 80G Reg. Number",
    regPlaceholder: "NGO/DARPAN/XXXX",
    licenseLabel: "FCRA / 12A Number",
    licensePlaceholder: "FCRA No. (if applicable)",
    docsHint: "NGO Darpan cert, 80G / 12A, PAN card",
    contactLabel: "Founder / Director",
    contactPlaceholder: "Mr. Arjun Nair",
    emailPlaceholder: "contact@ngo.org",
    submitLabel: "Register NGO / Foundation",
  },
];

function HospitalRegister() {
  const [showPass, setShowPass] = useState(false);
  const [orgType, setOrgType] = useState("hospital");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  // Form fields
  const [name, setName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [license, setLicense] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");

  const org = orgTypes.find((o) => o.id === orgType)!;

  const handleSubmit = async () => {
    setError("");
    if (!name || !regNumber || !address || !city || !contactPerson || !contactMobile || !contactEmail || !password) {
      setError("Please fill in all required fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await api.auth.registerHospital({
        name,
        reg_number: regNumber,
        license: license || undefined,
        address,
        city,
        contact_person: contactPerson,
        contact_mobile: contactMobile,
        contact_email: contactEmail,
        password,
      });
      login("hospital", name, orgType as any);
      navigate("/dashboard");
    } catch (e: any) {
      setError(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Organization Type Radio Buttons */}
      <div className="space-y-2">
        <Label className="font-body font-semibold text-sm">Organization Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {orgTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setOrgType(type.id)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all font-body text-sm font-semibold ${orgType === type.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
                }`}
            >
              <span className="text-lg">{type.emoji}</span>
              {type.label}
              {orgType === type.id && (
                <span className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic fields based on org type */}
      <motion.div
        key={orgType}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-2 gap-4"
      >
        <div className="col-span-2 space-y-1.5">
          <Label className="font-body font-semibold text-sm">{org.nameLabel}</Label>
          <Input placeholder={org.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl font-body" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-body font-semibold text-sm">{org.regLabel}</Label>
          <Input placeholder={org.regPlaceholder} value={regNumber} onChange={(e) => setRegNumber(e.target.value)} className="h-11 rounded-xl font-body" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-body font-semibold text-sm">{org.licenseLabel}</Label>
          <Input placeholder={org.licensePlaceholder} value={license} onChange={(e) => setLicense(e.target.value)} className="h-11 rounded-xl font-body" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="font-body font-semibold text-sm">Full Address</Label>
          <Input placeholder="Street, Area, State - PIN" value={address} onChange={(e) => setAddress(e.target.value)} className="h-11 rounded-xl font-body" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="font-body font-semibold text-sm">City</Label>
          <Input placeholder="E.g., Mumbai, Delhi, Kochi" value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded-xl font-body" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-body font-semibold text-sm">{org.contactLabel}</Label>
          <Input placeholder={org.contactPlaceholder} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="h-11 rounded-xl font-body" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-body font-semibold text-sm">Contact Mobile</Label>
          <Input type="tel" placeholder="+91 98765 43210" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} className="h-11 rounded-xl font-body" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="font-body font-semibold text-sm">Official Email</Label>
          <Input type="email" placeholder={org.emailPlaceholder} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-11 rounded-xl font-body" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="font-body font-semibold text-sm">Upload Documents</Label>
          <FileUploadZone
            accept="image/*,.pdf"
            maxSizeMB={10}
            hint={org.docsHint}
            multiple
            accentClass="primary"
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="font-body font-semibold text-sm">Password</Label>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              placeholder="Secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl font-body pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </motion.div>

      {error && (
        <p className="font-body text-sm text-blood font-semibold">{error}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full h-12 bg-gradient-primary text-primary-foreground font-body font-bold rounded-xl shadow-primary"
      >
        {loading ? "Registering..." : org.submitLabel}
      </Button>
    </motion.div>
  );
}

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("type") === "hospital" ? "hospital" : "donor";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[42%] bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-accent blur-3xl" />
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
            <h2 className="font-display text-4xl font-black text-primary-foreground leading-tight mb-4">
              Join 12 Lakh+<br />Lifesavers.
            </h2>
            <p className="font-body text-primary-foreground/70 leading-relaxed mb-8">
              Register once. Save lives forever. Your single donation can impact up to 8 people directly.
            </p>
            <div className="space-y-4">
              {[
                { emoji: "🛡️", label: "Aadhaar-verified, fully secure" },
                { emoji: "🎖️", label: "Build your Trust Score over time" },
                { emoji: "📱", label: "Real-time alerts for nearby needs" },
                { emoji: "❤️", label: "See the impact of each donation" },
              ].map(({ emoji, label }) => (
                <div key={label} className="flex items-center gap-3 text-primary-foreground/80">
                  <span>{emoji}</span>
                  <span className="font-body text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="font-body text-xs text-primary-foreground/40">© 2025 LifeForge Connect</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-start p-6 md:p-8 overflow-y-auto">
        <div className="w-full max-w-lg py-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 font-body text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>

          <div className="lg:hidden flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Heart className="w-4 h-4 text-primary-foreground fill-current" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">LifeForge Connect</span>
          </div>

          <h1 className="font-display text-3xl font-bold text-foreground mb-1">Create Account</h1>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Already registered?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">Login</Link>
          </p>

          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full grid grid-cols-2 bg-muted rounded-xl h-11 mb-6">
              <TabsTrigger value="donor" className="rounded-lg font-body font-semibold">
                🩸 Donor / Individual
              </TabsTrigger>
              <TabsTrigger value="hospital" className="rounded-lg font-body font-semibold">
                🏥 Hospital / Org
              </TabsTrigger>
            </TabsList>
            <TabsContent value="donor">
              <DonorRegister />
            </TabsContent>
            <TabsContent value="hospital">
              <HospitalRegister />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

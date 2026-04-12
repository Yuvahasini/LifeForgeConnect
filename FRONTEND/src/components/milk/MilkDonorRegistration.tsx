import { useState } from "react";
import { Loader2, Droplets, Heart, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api, getCurrentUserId, isLoggedIn } from "@/lib/api";
import { toast } from "sonner";

interface MilkDonorRegistrationProps {
  onSuccess?: () => void;
}

export default function MilkDonorRegistration({ onSuccess }: MilkDonorRegistrationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    babyAge: "",
    qty: 0,
    location: "",
    pincode: "",
    isAnonymous: false,
    availabilityStart: "08:00",
    availabilityEnd: "20:00"
  });

  const handleRegisterDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn()) {
      toast.error("Please login to register as a donor");
      return;
    }
    const donorId = getCurrentUserId();

    if (!donorId) {
      toast.error("Your session is missing a user ID. Please log out and log in again.");
      return;
    }

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
      toast.success("Successfully registered as a milk donor!");
      setFormData({
        babyAge: "", qty: 0, location: "", pincode: "",
        isAnonymous: false, availabilityStart: "08:00", availabilityEnd: "20:00"
      });
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to register as donor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
  );
}

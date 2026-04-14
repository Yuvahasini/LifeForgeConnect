import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, AlertTriangle, Clock, CheckCircle, Package, TrendingUp,
  X, Loader2, MapPin, Calendar, Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MilkHospitalDashboard as DashboardType, api, getCurrentUserId } from "@/lib/api";
import { toast } from "sonner";

interface MilkHospitalDashboardProps {
  dashboard: DashboardType | null;
  onFindMatches: (request: any) => void;
  onPostShortage: () => void;
  onRefresh: () => void;
}

// Match status progression
const MATCH_STATUSES: Record<string, { label: string; color: string; next: string | null }> = {
  pending:          { label: "Pending",          color: "bg-amber-100 text-amber-700",    next: "accepted" },
  accepted:         { label: "Accepted",         color: "bg-green-100 text-green-700",    next: "pickup_scheduled" },
  pickup_scheduled: { label: "Pickup Scheduled", color: "bg-blue-100 text-blue-700",      next: "collected" },
  collected:        { label: "Collected",        color: "bg-purple-100 text-purple-700",  next: "delivered" },
  delivered:        { label: "Delivered",        color: "bg-secondary/15 text-secondary", next: null },
  declined:         { label: "Declined",         color: "bg-red-100 text-red-700",        next: null },
};

export default function MilkHospitalDashboard({
  dashboard,
  onFindMatches,
  onPostShortage,
  onRefresh,
}: MilkHospitalDashboardProps) {
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("10:00");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  if (!dashboard) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading hospital dashboard...</p>
      </div>
    );
  }

  // Schedule pickup for an accepted match
  const handleSchedulePickup = async () => {
    if (!selectedMatch || !pickupDate) {
      toast.error("Please select a pickup date");
      return;
    }
    setIsUpdating(selectedMatch.id);
    try {
      await api.milk.updateMatchStatus(selectedMatch.id, {
        status: "pickup_scheduled",
        pickup_date: pickupDate,
        pickup_time: pickupTime,
      });
      toast.success("Pickup scheduled! Donor has been notified.");
      setShowPickupModal(false);
      setSelectedMatch(null);
      setPickupDate("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule pickup");
    } finally {
      setIsUpdating(null);
    }
  };

  // Mark donation as collected
  const handleMarkCollected = async (match: any) => {
    setIsUpdating(match.id);
    try {
      await api.milk.updateMatchStatus(match.id, { status: "collected" });
      toast.success("Marked as collected! Donor has been notified.");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setIsUpdating(null);
    }
  };

  // Log donation and mark as delivered (Milk Passport)
  const handleLogDonation = async (match: any) => {
    const hospitalId = getCurrentUserId();
    if (!hospitalId) {
      toast.error("Please login as hospital");
      return;
    }

    // FIX: match.donor_id is now returned by the backend in matched_donors
    const donorId = match.donor_id;
    if (!donorId) {
      toast.error("Donor information missing. Please refresh and try again.");
      return;
    }

    setIsUpdating(match.id);
    try {
      // Create Milk Passport donation record
      const result = await api.milk.createDonation({
        donor_id: donorId,
        request_id: match.request_id,
        collection_date: new Date().toISOString().split("T")[0],
        volume_ml: match.quantity_ml || 200,
        receiving_hospital_id: hospitalId,
        pasteurized: false,
      });

      // Mark match as delivered
      await api.milk.updateMatchStatus(match.id, { status: "delivered" });

      toast.success(`Donation logged! Passport ID: ${result.passport_id}`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to log donation");
      console.error("[handleLogDonation] error:", e);
    } finally {
      setIsUpdating(null);
    }
  };

  const getStatusConfig = (status: string) =>
    MATCH_STATUSES[status] || MATCH_STATUSES.pending;

  return (
    <div className="space-y-8">

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Active Requests",  value: dashboard.stats.active_requests,                          icon: AlertTriangle, color: "text-blood"      },
          { label: "Pending Matches",  value: dashboard.stats.pending_matches,                          icon: Clock,         color: "text-amber-500"  },
          { label: "Accepted",         value: dashboard.stats.accepted_matches,                          icon: CheckCircle,   color: "text-secondary"  },
          { label: "Total Received",   value: `${(dashboard.stats.total_received_ml / 1000).toFixed(1)}L`, icon: Package,    color: "text-milk"       },
          { label: "Donations",        value: dashboard.stats.donations_received,                        icon: TrendingUp,    color: "text-purple-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card rounded-2xl border p-4 shadow-sm">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <div className="font-display text-2xl font-bold">{value}</div>
            <div className="font-body text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Active Requests ─────────────────────────────────────────── */}
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Active Requests</h3>
            <Button onClick={onPostShortage} size="sm" className="bg-blood text-white">
              + New Request
            </Button>
          </div>
          {dashboard.active_requests.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active requests</p>
          ) : (
            <div className="space-y-3">
              {dashboard.active_requests.map((req) => (
                <div key={req.id} className="p-3 rounded-xl bg-muted/30 flex items-center justify-between">
                  <div>
                    <p className="font-body font-semibold text-sm">{req.infant_ref}</p>
                    <p className="font-body text-xs text-muted-foreground">
                      {req.volume_ml}ml/day —{" "}
                      <span className={
                        req.urgency === "critical" ? "text-blood font-bold" :
                        req.urgency === "urgent"   ? "text-amber-600 font-semibold" : ""
                      }>
                        {req.urgency?.toUpperCase()}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onFindMatches({ id: req.id, hospital: dashboard.hospital.name })}
                  >
                    Find Matches
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Matched Donors — Coordination Workflow ─────────────────── */}
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <h3 className="font-display font-bold mb-4 flex items-center gap-2">
            Matched Donors
            <Badge variant="outline" className="font-body text-[10px]">
              Coordination Flow
            </Badge>
          </h3>
          {dashboard.matched_donors.length === 0 ? (
            <p className="text-muted-foreground text-sm">No matches yet. Use "Find Matches" on an active request.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.matched_donors.map((m: any) => {
                const statusConfig = getStatusConfig(m.status);
                const busy = isUpdating === m.id;
                return (
                  <div key={m.id} className="p-4 rounded-xl bg-muted/30 border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-body font-semibold flex items-center gap-2">
                          {m.donor_name}
                          <Badge className={`text-[9px] ${statusConfig.color}`}>
                            {statusConfig.label}
                          </Badge>
                        </p>
                        <p className="font-body text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {m.city}
                          {m.quantity_ml && <span className="ml-2">• {m.quantity_ml}ml/day</span>}
                        </p>
                        {/* Show scheduled pickup info */}
                        {m.status === "pickup_scheduled" && m.pickup_date && (
                          <p className="font-body text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Pickup: {m.pickup_date}{m.pickup_time ? ` at ${m.pickup_time}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons based on current status */}
                    <div className="flex gap-2 mt-3">
                      {m.status === "accepted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          disabled={busy}
                          onClick={() => {
                            setSelectedMatch(m);
                            setShowPickupModal(true);
                          }}
                        >
                          <Calendar className="w-3 h-3 mr-1" />
                          Schedule Pickup
                        </Button>
                      )}

                      {m.status === "pickup_scheduled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          disabled={busy}
                          onClick={() => handleMarkCollected(m)}
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                            <><Package className="w-3 h-3 mr-1" /> Mark Collected</>
                          )}
                        </Button>
                      )}

                      {m.status === "collected" && (
                        <Button
                          size="sm"
                          className="flex-1 text-xs bg-secondary text-white"
                          disabled={busy}
                          onClick={() => handleLogDonation(m)}
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                            <><CheckCircle className="w-3 h-3 mr-1" /> Log & Complete</>
                          )}
                        </Button>
                      )}

                      {m.status === "pending" && (
                        <p className="text-xs text-muted-foreground italic">
                          Waiting for donor to respond...
                        </p>
                      )}

                      {m.status === "delivered" && (
                        <p className="text-xs text-secondary font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Donation completed ✓
                        </p>
                      )}

                      {m.status === "declined" && (
                        <p className="text-xs text-red-500 italic">
                          Donor declined. Try finding other matches.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Donation History ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <h3 className="font-display font-bold mb-4">Recent Donations Received</h3>
        {dashboard.donation_history.length === 0 ? (
          <p className="text-muted-foreground text-sm">No donation history yet.</p>
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
                {dashboard.donation_history.map((d) => (
                  <tr key={d.passport_id} className="border-b last:border-0">
                    <td className="py-3 font-body text-sm text-milk font-semibold">{d.passport_id}</td>
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

      {/* ── Pickup Scheduling Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showPickupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-card rounded-3xl border-2 border-milk/20 shadow-2xl overflow-hidden"
            >
              <div className="bg-milk p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-display text-xl font-bold">Schedule Pickup</h3>
                  <p className="text-foreground/70 text-xs font-body">{selectedMatch?.donor_name}</p>
                </div>
                <button
                  onClick={() => { setShowPickupModal(false); setSelectedMatch(null); }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                    Pickup Date *
                  </Label>
                  <Input
                    type="date"
                    className="rounded-xl"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                    Pickup Time
                  </Label>
                  <Input
                    type="time"
                    className="rounded-xl"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                  />
                </div>

                <p className="font-body text-[11px] text-muted-foreground italic bg-milk/10 p-3 rounded-xl">
                  The donor will receive an SMS and in-app notification with these pickup details.
                </p>

                <Button
                  onClick={handleSchedulePickup}
                  disabled={isUpdating !== null || !pickupDate}
                  className="w-full bg-milk text-foreground font-bold h-12 rounded-xl"
                >
                  {isUpdating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <><Truck className="w-4 h-4 mr-2" /> Confirm Pickup</>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
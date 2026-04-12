/**
 * src/lib/api.ts
 * ──────────────────────────────────────────────────────────────────
 * Single API client for the LifeForge Connect frontend.
 * Place this file at:  FRONTEND/src/lib/api.ts
 *
 * Add to your FRONTEND/.env:
 *   VITE_API_URL=http://localhost:8000
 *
 * Usage in any component / page:
 *   import { api } from "@/lib/api"
 *   const donors = await api.blood.getDonors({ blood_group: "O-" })
 * ──────────────────────────────────────────────────────────────────
 */

const BASE = import.meta.env.VITE_API_URL ?? "";

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function req<T>(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined | null>
): Promise<T> {
    let url: URL | string;

    if (BASE) {
        const urlObj = new URL(BASE + path);
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined && v !== null) urlObj.searchParams.set(k, String(v));
            });
        }
        url = urlObj.toString();
    } else {
        let relativePath = path;
        if (params) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined && v !== null) searchParams.set(k, String(v));
            });
            const queryString = searchParams.toString();
            if (queryString) relativePath += `?${queryString}`;
        }
        url = relativePath;
    }

    const headers: HeadersInit = { "Content-Type": "application/json" };

    const token = localStorage.getItem("lf_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "API request failed");
    }

    return res.json() as Promise<T>;
}

const get = <T>(path: string, params?: Record<string, any>) => req<T>("GET", path, undefined, params);
const post = <T>(path: string, body?: unknown) => req<T>("POST", path, body);
const patch = <T>(path: string, body?: unknown) => req<T>("PATCH", path, body);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: "blood_request" | "blood_response" | "general";
    created_at: string;
    is_read: boolean;
}

export interface PlatformStats {
    matches_today: number;
    lives_impacted: number;
    active_donors_online: number;
    hospitals_connected: number;
}

export interface BloodDonor {
    id: string; name: string; city: string; group: string;
    trust: number; trust_score: number; is_verified: boolean;
    available: boolean; eligible_to_donate: boolean;
    last_donated: string; distance_km: number | null; distance: string;
    lat?: number; lng?: number;
}

export interface BloodRequest {
    id: string; hospital: string; group: string; units: number;
    urgency: string; timeLeft: string; city: string; posted: string;
    hours_left?: number;
}

export interface BloodShortage {
    blood_group: string; requests: number; donors_available: number;
    deficit: number; severity: string;
}

export interface ThalPatient {
    id: string; name: string; age: number | null; group: string;
    hospital: string; freq: string; nextDate: string;
    donor: string; countdown: string; days_until: number | null; is_urgent: boolean;
}

export interface CalendarDay {
    day: string; date: string; has: boolean;
    label: string | null; patients: string[];
}

export interface PlateletRequest {
    id: string; patient: string; cancer: string; group: string;
    units: number; expiry: string; urgency: string;
    hospital: string; hospital_city: string;
    days_left: number; hours_left: number; is_critical: boolean;
}

export interface PlateletDonor {
    id: string; name: string; group: string; compat: number; trust: number;
    lastApheresis: string; nextAvail: string; city: string;
}

export interface MarrowMatch {
    id: string; donor_id: string; matchPct: number; confidence: string;
    hlaA: string; hlaB: string; location: string;
    age: number | null; donated: number; status: string;
}

export interface OrganViability {
    name: string; emoji: string; window: string;
    viabilityHrs: number; color: string;
}

export interface OrganRecipient {
    id: string; name: string; organ: string; blood: string;
    urgency: number; hospital: string; hospital_city: string;
    wait: string; distance_km: number | null; rank: number;
}

export interface MilkDonor {
    id: string; donor_id: string; name: string; babyAge: string;
    qty: string; area: string; verified: boolean; impact: string;
    pincode?: string; screening_status?: string; is_screened?: boolean;
    trust_score?: number; distance_km?: number | null; distance?: string;
    is_anonymous?: boolean; availability_start?: string; availability_end?: string;
}

export interface MilkBankRow {
    id: string; from: string; pasteurized: string;
    expiry: string; qty: string; status: string; type?: string;
}

export interface MilkShortageAlert {
    id: string; hospital: string; city: string;
    infant_name: string | null; quantity_needed: string; message: string;
    urgency?: string; volume_ml?: number; pincode?: string;
    time_left?: string; hours_left?: number;
}

export interface MilkMatch {
    milk_donor_id: string; donor_id: string; name: string;
    city: string; pincode: string; quantity_ml: number;
    distance_km: number | null; distance: string; match_score: number;
    trust_score: number; verified: boolean; is_anonymous: boolean;
    pincode_match: boolean;
}

export interface MilkMatchResult {
    request_id: string; hospital: string; city: string;
    quantity_needed: number; urgency: string;
    total_matches: number; matches: MilkMatch[];
}

export interface MilkDonation {
    passport_id: string; donor_name: string; collection_date: string;
    volume_ml: number; pasteurized: boolean; pasteurization_date?: string;
    pasteurization_method?: string; expiry_date?: string;
    receiving_hospital?: string; receiving_city?: string;
    receiving_infant_ref?: string; status: string;
    quality_check_passed?: boolean; created_at: string;
}

export interface MilkHospitalDashboard {
    hospital: { id: string; name: string; city: string };
    stats: {
        active_requests: number; pending_matches: number;
        accepted_matches: number; total_received_ml: number;
        donations_received: number;
    };
    active_requests: Array<{
        id: string; infant_ref: string; volume_ml: number;
        urgency: string; created_at: string;
    }>;
    matched_donors: Array<{
        id: string; donor_name: string; city: string;
        quantity_ml: number; status: string; request_id: string;
    }>;
    donation_history: Array<{
        passport_id: string; donor_name: string; volume_ml: number;
        date: string; status: string;
    }>;
}

export interface DonorDashboard {
    profile: {
        id: string; name: string; initial: string; blood_group: string;
        city: string; is_verified: boolean; donor_types: string[];
        trust_stars: number; is_available: boolean;
    };
    stats: {
        total_donations: number; lives_impacted: number;
        trust_score: number; next_eligible: string;
    };
    urgent_requests: Array<{
        type: string; module: string; group: string; hospital: string;
        distance: string; urgency: string; time: string;
    }>;
    donation_history: Array<{
        date: string; type: string; hospital: string; status: string; impact: string;
    }>;
}

export interface AdminDashboard {
    stats: {
        pending_verifications: number; flagged_accounts: number;
        total_users: number; todays_matches: number;
    };
    verification_queue: {
        donors: Array<{ id: string; name: string; type: string; city: string; docs: string; time: string }>;
        hospitals: Array<{ id: string; name: string; type: string; city: string; docs: string; time: string }>;
    };
    flagged_accounts: Array<{ id: string; name: string; city: string; trust_score: number }>;
}


// ── API surface ───────────────────────────────────────────────────────────────

export const api = {

    // ── Platform ────────────────────────────────────────────────────────────────

    stats: () =>
        get<PlatformStats>("/stats"),


    // ── Auth ────────────────────────────────────────────────────────────────────

    auth: {
        registerDonor: (body: {
            first_name: string; last_name: string; mobile: string;
            aadhaar?: string; dob?: string; gender?: string;
            city: string; pincode?: string; blood_group: string;
            donor_types: string[]; email: string; password: string;
            lat?: number; lng?: number;
        }) => post("/auth/register/donor", body),

        registerHospital: (body: {
            name: string; reg_number: string; license?: string;
            address: string; city: string; contact_person: string;
            contact_mobile: string; contact_email: string; password: string;
        }) => post("/auth/register/hospital", body),

        login: async (email: string, password: string, role = "donor") => {
            const data = await post<{ access_token: string; user_id: string; role: string; redirect: string; profile: any }>(
                "/auth/login", { email, password, role }
            );
            localStorage.setItem("lf_token", data.access_token);
            localStorage.setItem("lf_user_id", data.user_id);
            localStorage.setItem("lf_role", data.role);
            // Also sync with AuthContext keys
            localStorage.setItem("lfc_role", data.role);
            return data;
        },

        logout: () => {
            localStorage.removeItem("lf_token");
            localStorage.removeItem("lf_user_id");
            localStorage.removeItem("lf_role");
            localStorage.removeItem("lfc_role");
            localStorage.removeItem("lfc_userName");
            localStorage.removeItem("lfc_orgType");
            localStorage.removeItem("lfc_profile");
        },

        sendOtp: (mobile: string) => post("/auth/otp/send", { mobile }),
        verifyOtp: (mobile: string, otp: string) => post("/auth/otp/verify", { mobile, otp }),
    },


    // ── Notifications ───────────────────────────────────────────────────────────

    notifications: {
        get: (userId: string) =>
            get<Notification[]>(`/notifications/${userId}`),

        markRead: (notificationIds: string[]) =>
            post<{ success: boolean }>("/notifications/mark-read", { ids: notificationIds }),
    },


    // ── BloodBridge ─────────────────────────────────────────────────────────────

    blood: {
        getDonors: (params?: { blood_group?: string; city?: string; pincode?: string; lat?: number; lng?: number; limit?: number }) =>
            get<BloodDonor[]>("/blood/donors", params),

        getOpenRequests: () =>
            get<BloodRequest[]>("/blood/requests/open"),

        postRequest: (body: { hospital_id: string; blood_group: string; units: number; urgency: string; donor_id?: string; lat?: number; lng?: number }) =>
            post("/blood/requests", body),

        requestDonor: (body: { hospital_id: string; donor_id: string; blood_group: string; units: number; urgency: string }) =>
            post("/blood/donors/request", body),

        getRequestsForDonor: (donorId: string) =>
            get<BloodRequest[]>("/blood/requests/for-donor", { donor_id: donorId }),

        getShortage: () =>
            get<BloodShortage[]>("/blood/shortage"),
    },


    // ── ThalCare ────────────────────────────────────────────────────────────────

    thal: {
        getPatients: (hospitalId?: string) =>
            get<ThalPatient[]>("/thal/patients", hospitalId ? { hospital_id: hospitalId } : undefined),

        getCalendar: (daysAhead = 7) =>
            get<CalendarDay[]>("/thal/calendar", { days_ahead: daysAhead }),

        registerPatient: (body: { name: string; blood_group: string; hospital_id: string; transfusion_frequency_days?: number; last_transfusion_date?: string }) =>
            post("/thal/patients", body),

        markDone: (patientId: string, transfusionDate: string) =>
            post("/thal/transfusion-done", { patient_id: patientId, transfusion_date: transfusionDate }),
    },


    // ── PlateletAlert ───────────────────────────────────────────────────────────

    // ── ADD THESE to the api.platelet section in api.ts ──────────────────────────
    // Find your existing api.platelet object and add/replace these methods:

    platelet: {
        getOpenRequests: (params?: {
            user_id?: string;
            urgency?: string;
            blood_group?: string;
        }) => {
            const qs = new URLSearchParams();
            if (params?.user_id) qs.set("user_id", params.user_id);
            if (params?.urgency) qs.set("urgency", params.urgency);
            if (params?.blood_group) qs.set("blood_group", params.blood_group);
            return get<PlateletRequest[]>(`/platelet/requests/open?${qs.toString()}`);
        },

        getDonors: (params?: { blood_group?: string; city?: string }) => {
            const qs = new URLSearchParams();
            if (params?.blood_group) qs.set("blood_group", params.blood_group);
            if (params?.city) qs.set("city", params.city);
            return get<PlateletDonor[]>(`/platelet/donors?${qs.toString()}`);
        },

        postRequest: (body: {
            patient_name: string;
            cancer_type?: string;
            blood_group: string;
            units: number;
            urgency: string;
            hospital_id: string;
        }) => post<{ success: boolean; request_id: string }>("/platelet/requests", body),

        // ── NEW: Match endpoints ──

        createMatch: (body: { request_id: string; donor_id: string }) =>
            post<{ success: boolean; match_id: string }>("/platelet/matches", body),

        updateMatch: (matchId: string, body: { status: string; donor_id: string }) =>
            patch<{ success: boolean }>(`/platelet/matches/${matchId}`, body),

        getDonorMatches: (donorId: string) =>
            get<any[]>(`/platelet/matches/donor/${donorId}`),

        getHospitalMatches: (hospitalId: string) =>
            get<any[]>(`/platelet/matches/hospital/${hospitalId}`),
    },

    // ── MarrowMatch ─────────────────────────────────────────────────────────────

    marrow: {
        findMatches: (patientHla: string[], patientId?: string, minMatchPercent = 30) =>
            post<{ patient_hla: string[]; total_found: number; matches: MarrowMatch[] }>(
                "/marrow/match", { patient_hla: patientHla, patient_id: patientId, min_match_percent: minMatchPercent }
            ),

        contact: (body: { donor_id: string; patient_name?: string; urgency?: string; message?: string }) =>
            post("/marrow/contact", body),

        registerHla: (donorId: string, hlaType: string[]) =>
            post("/marrow/register-hla", { donor_id: donorId, hla_type: hlaType }),

        getDonors: () => get("/marrow/donors"),
    },


    // ── LastGift (Organs) ────────────────────────────────────────────────────────

    organ: {
        getViability: () =>
            get<OrganViability[]>("/organ/viability"),

        getRecipients: (params?: { organ_type?: string; blood_group?: string; donor_lat?: number; donor_lng?: number }) =>
            get<OrganRecipient[]>("/organ/recipients", params),

        createPledge: (body: { donor_id: string; organs: string[]; family_consent: boolean }) =>
            post<{ pledge_id: string; pledge_id_short: string; organs_pledged: string[] }>("/organ/pledge", body),

        postRequest: (body: { hospital_id: string; recipient_name: string; organ_needed: string; blood_group: string; urgency_score?: number }) =>
            post("/organ/requests", body),
    },


    // ── MilkBridge ──────────────────────────────────────────────────────────────

    milk: {
        getDonors: (params?: {
            pincode?: string;
            city?: string;
            screening_status?: string;
            lat?: number;
            lng?: number;
            limit?: number;
        }) => get<MilkDonor[]>("/milk/donors", params),

        getDonorDetail: (milkDonorId: string) =>
            get<MilkDonor>(`/milk/donors/${milkDonorId}`),

        getBank: () =>
            get<MilkBankRow[]>("/milk/bank"),

        getShortageAlerts: () =>
            get<MilkShortageAlert[]>("/milk/shortage-alerts"),

        getOpenRequests: () =>
            get<MilkShortageAlert[]>("/milk/requests/open"),

        getRequestsForDonor: (donorId: string) =>
            get<any[]>("/milk/requests/for-donor", { donor_id: donorId }),

        registerDonor: (body: {
            donor_id: string;
            baby_age_months: number;
            quantity_ml_per_day: number;
            pickup_location?: string;
            city?: string;
            pincode?: string;
            is_anonymous?: boolean;
            availability_start?: string;
            availability_end?: string;
        }) => post<{ success: boolean; milk_donor_id: string; message: string }>("/milk/register-donor", body),

        updateDonor: (milkDonorId: string, body: {
            is_available?: boolean;
            quantity_ml_per_day?: number;
            baby_age_months?: number;
            is_anonymous?: boolean;
        }) => patch<{ success: boolean; message: string }>(`/milk/donors/${milkDonorId}`, body),

        postRequest: (body: {
            hospital_id: string;
            infant_name?: string;
            daily_quantity_ml: number;
            urgency?: string;
            pincode?: string;
        }) => post<{ success: boolean; request_id: string; donors_notified: number; sms_sent: number; message: string }>("/milk/requests", body),

        // Smart matching
        findMatches: (body: {
            request_id: string;
            max_distance_km?: number;
            min_quantity_ml?: number;
            limit?: number;
        }) => post<MilkMatchResult>("/milk/match", body),

        createMatch: (body: { request_id: string; donor_id: string; milk_donor_id?: string }) =>
            post<{ success: boolean; match_id: string; message: string }>("/milk/matches", body),

        respondToMatch: (matchId: string, body: { donor_id: string; status: "accepted" | "declined" }) =>
            post<{ success: boolean; status: string; message: string }>(`/milk/matches/${matchId}/respond`, body),

        // Donation tracking (Milk Passport)
        createDonation: (body: {
            donor_id: string;
            request_id?: string;
            collection_date: string;
            volume_ml: number;
            pasteurized?: boolean;
            pasteurization_date?: string;
            pasteurization_method?: string;
            receiving_hospital_id?: string;
            receiving_infant_ref?: string;
            notes?: string;
        }) => post<{ success: boolean; passport_id: string; donation_id: string; expiry_date: string; message: string }>("/milk/donations", body),

        getDonation: (passportId: string) =>
            get<MilkDonation>(`/milk/donations/${passportId}`),

        // Hospital dashboard
        getHospitalDashboard: (hospitalId: string) =>
            get<MilkHospitalDashboard>(`/milk/dashboard/hospital/${hospitalId}`),
    },


    // ── Dashboard ───────────────────────────────────────────────────────────────

    dashboard: {
        getDonor: (donorId: string) =>
            get<DonorDashboard>(`/dashboard/donor/${donorId}`),

        getHospital: (hospitalId: string) =>
            get(`/dashboard/hospital/${hospitalId}`),

        getAdmin: () =>
            get<AdminDashboard>("/dashboard/admin"),

        verify: (entityType: "donor" | "hospital", entityId: string, approved: boolean) =>
            post("/dashboard/admin/verify", { entity_type: entityType, entity_id: entityId, approved }),
    },

};


// ── Convenience helpers ───────────────────────────────────────────────────────

export const getCurrentUserId = () => localStorage.getItem("lf_user_id") ?? "";
export const getCurrentRole = () => localStorage.getItem("lf_role") ?? "donor";
export const isLoggedIn = () => !!localStorage.getItem("lf_token");


// ── AI Chat ─────────────────────────────────────────────────────────────────

export interface AIChatMessage {
    role: "user" | "assistant";
    content: string;
}

/**
 * Stream a response from LifeForge AI.
 * Calls the backend /ai/chat endpoint which proxies to Gemini.
 * Returns a ReadableStream reader or falls back to sync.
 */
export async function streamAIChat(
    messages: AIChatMessage[],
    isUrgent = false,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
) {
    const url = `${BASE}/ai/chat`;

    // Timeout after 30s if no response at all
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                is_urgent: isUrgent,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            const detail = err.detail ?? "AI service error";
            if (res.status === 429) {
                onError("Rate limit reached. Please wait a moment and try again.");
            } else {
                onError(detail);
            }
            return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
            onError("Streaming not supported");
            return;
        }

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            onChunk(text);
        }
        onDone();
    } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === "AbortError") {
            onError("Request timed out. The AI service may be busy — please try again.");
        } else {
            onError(err.message ?? "Failed to connect to AI service");
        }
    }
}
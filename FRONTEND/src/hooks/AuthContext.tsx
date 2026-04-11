import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api, getCurrentUserId, Notification } from "@/lib/api";

export type UserRole = "donor" | "hospital" | "admin" | null;
export type OrgType = "hospital" | "bloodbank" | "orphanage" | "ngo" | null;

export interface UserProfile {
    name?: string;
    city?: string;
    blood_group?: string;
    trust_score?: number;
    is_verified?: boolean;
    donor_types?: string[];
}

interface AuthContextType {
    role: UserRole;
    orgType: OrgType;
    userName: string;
    profile: UserProfile | null;
    notifications: Notification[];
    unreadCount: number;
    login: (role: UserRole, userName: string, orgType?: OrgType, profile?: UserProfile) => void;
    logout: () => void;
    markNotificationsRead: () => Promise<void>;
    refreshNotifications: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    role: null,
    orgType: null,
    userName: "",
    profile: null,
    notifications: [],
    unreadCount: 0,
    login: () => { },
    logout: () => { },
    markNotificationsRead: async () => { },
    refreshNotifications: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<UserRole>(() => {
        const saved = localStorage.getItem("lfc_role");
        return (saved as UserRole) || null;
    });
    const [orgType, setOrgType] = useState<OrgType>(() => {
        const saved = localStorage.getItem("lfc_orgType");
        return (saved as OrgType) || null;
    });
    const [userName, setUserName] = useState(() => {
        return localStorage.getItem("lfc_userName") || "";
    });
    const [profile, setProfile] = useState<UserProfile | null>(() => {
        const saved = localStorage.getItem("lfc_profile");
        return saved ? JSON.parse(saved) : null;
    });
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    // Fetch notifications for the current user
    const refreshNotifications = useCallback(async () => {
        const userId = getCurrentUserId();
        if (!userId) return;
        try {
            const data = await api.notifications.get(userId);
            setNotifications(data);
        } catch {
            // silently fail — notifications are non-critical
        }
    }, []);

    // Mark all current unread notifications as read
    const markNotificationsRead = useCallback(async () => {
        const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
        if (unreadIds.length === 0) return;
        try {
            await api.notifications.markRead(unreadIds);
            setNotifications((prev) =>
                prev.map((n) => (unreadIds.includes(n.id) ? { ...n, is_read: true } : n))
            );
        } catch {
            // silently fail
        }
    }, [notifications]);

    // Poll for new notifications every 30 seconds when logged in
    useEffect(() => {
        if (!role) return;
        refreshNotifications();
        const interval = setInterval(refreshNotifications, 30_000);
        return () => clearInterval(interval);
    }, [role, refreshNotifications]);

    // Persist role, orgType, userName, profile to localStorage
    useEffect(() => {
        role ? localStorage.setItem("lfc_role", role) : localStorage.removeItem("lfc_role");
    }, [role]);
    useEffect(() => {
        orgType ? localStorage.setItem("lfc_orgType", orgType) : localStorage.removeItem("lfc_orgType");
    }, [orgType]);
    useEffect(() => {
        userName ? localStorage.setItem("lfc_userName", userName) : localStorage.removeItem("lfc_userName");
    }, [userName]);
    useEffect(() => {
        profile ? localStorage.setItem("lfc_profile", JSON.stringify(profile)) : localStorage.removeItem("lfc_profile");
    }, [profile]);

    const login = (newRole: UserRole, name: string, newOrgType?: OrgType, newProfile?: UserProfile) => {
        setRole(newRole);
        setUserName(name);
        setOrgType(newOrgType || null);
        setProfile(newProfile || null);
    };

    const logout = () => {
        setRole(null);
        setUserName("");
        setOrgType(null);
        setProfile(null);
        setNotifications([]);
    };

    return (
        <AuthContext.Provider value={{
            role, orgType, userName, profile,
            notifications, unreadCount,
            login, logout,
            markNotificationsRead, refreshNotifications,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
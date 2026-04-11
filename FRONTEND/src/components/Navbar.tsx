import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Heart, LogOut, LayoutDashboard, Settings, Bell, ChevronDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/AuthContext";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { role, userName, logout, notifications, unreadCount, markNotificationsRead } = useAuth();

  const profileRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleAlertsOpen = () => {
    const opening = !alertsOpen;
    setAlertsOpen(opening);
    setProfileOpen(false);

    // Mark as read when CLOSING, not opening
    if (!opening && unreadCount > 0) {
      markNotificationsRead();
    }
  };

  const handleProfileOpen = () => {
    setProfileOpen((p) => !p);
    setAlertsOpen(false);
  };

  const isHome = location.pathname === "/";
  const textColor = scrolled || !isHome ? "text-foreground" : "text-primary-foreground";

  // Only show unread notifications in the dropdown (they disappear once read)
  const unreadNotifications = notifications.filter((n) => !n.is_read);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled || !isHome
      ? "bg-card/95 backdrop-blur-md shadow-card border-b border-border"
      : "bg-transparent"
      }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-primary">
              <Heart className="w-5 h-5 text-primary-foreground fill-current" />
            </div>
            <div className="leading-tight">
              <span className={`font-display font-bold text-lg ${textColor}`}>LifeForge</span>
              <span className={`font-body text-xs block -mt-1 font-semibold tracking-widest uppercase ${scrolled || !isHome ? "text-primary" : "text-accent"}`}>
                Connect
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/dashboard"
              className={`font-body text-sm font-medium transition-colors hover:opacity-80 ${textColor}`}
            >
              Dashboard
            </Link>

            <Link
              to="/ai-companion"
              className={`font-body text-sm font-bold flex items-center gap-1.5 transition-colors hover:opacity-80 ${textColor}`}
            >
              <span className="animate-pulse text-lg">✨</span> AI Companion
            </Link>

            {!role ? (
              <>
                <Link to="/login">
                  <Button variant="outline" size="sm" className={`font-body font-semibold border-2 ${scrolled || !isHome
                    ? "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    : "border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground/10"
                    }`}>
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="font-body font-semibold bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-primary">
                    Donate / Register
                  </Button>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">

                {/* ── Alerts button ── */}
                <div className="relative" ref={alertsRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAlertsOpen}
                    className="border-border font-body rounded-xl gap-1.5 relative"
                  >
                    <Bell className="w-4 h-4" />
                    Alerts
                    {unreadCount > 0 && (
                      <Badge className="ml-0.5 bg-primary text-primary-foreground text-xs border-0">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>

                  <AnimatePresence>
                    {alertsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-80 bg-card rounded-xl shadow-lg border border-border overflow-hidden z-50"
                      >
                        <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
                          <span className="font-display font-bold text-sm text-foreground">Notifications</span>
                          {unreadNotifications.length > 0 && (
                            <Badge className="bg-primary/10 text-primary border-0 text-xs font-body">
                              {unreadNotifications.length} new
                            </Badge>
                          )}
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                          {unreadNotifications.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                              <p className="font-body text-sm text-muted-foreground font-semibold">All caught up!</p>
                              <p className="font-body text-xs text-muted-foreground mt-0.5">No new notifications</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-border">
                              {unreadNotifications.map((n) => (
                                <div key={n.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-start gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5 ${n.type === "blood_request" ? "bg-blood/10 text-blood" :
                                      n.type === "blood_response" ? "bg-secondary/10 text-secondary" :
                                        "bg-primary/10 text-primary"
                                      }`}>
                                      {n.type === "blood_request" ? "🩸" :
                                        n.type === "blood_response" ? "✅" : "🔔"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-body font-semibold text-sm text-foreground">{n.title}</p>
                                      <p className="font-body text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                                      <div className="flex items-center gap-1 mt-1">
                                        <Clock className="w-3 h-3 text-muted-foreground" />
                                        <span className="font-body text-[10px] text-muted-foreground">
                                          {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Settings */}
                <Link to="/settings">
                  <Button variant="outline" size="sm" className="border-border font-body rounded-xl gap-1.5">
                    <Settings className="w-4 h-4" /> Settings
                  </Button>
                </Link>

                {/* Profile dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={handleProfileOpen}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all font-body text-sm font-bold ${scrolled || !isHome
                      ? "border-border bg-card hover:border-primary/40 text-foreground"
                      : "border-primary-foreground/30 hover:border-primary-foreground/60 text-primary-foreground"
                      }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                      {userName?.charAt(0).toUpperCase()}
                    </div>
                    {userName}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-card rounded-xl shadow-lg border border-border overflow-hidden z-50"
                      >
                        <div className="px-4 py-3 border-b border-border bg-muted/40">
                          <p className="font-body text-xs text-muted-foreground">Signed in as</p>
                          <p className="font-display font-bold text-sm text-foreground truncate">{userName}</p>
                        </div>
                        <div className="p-1.5">
                          <button
                            onClick={() => { setProfileOpen(false); handleLogout(); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors font-body text-sm text-red-500"
                          >
                            <LogOut className="w-4 h-4" />
                            Logout
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className={`md:hidden p-2 rounded-lg ${textColor}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-card border-t border-border overflow-hidden"
            >
              <div className="py-4 space-y-1">
                {role && (
                  <div className="px-4 py-3 mb-2 bg-primary/5 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                        {userName?.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-display font-bold text-sm">{userName}</span>
                    </div>
                    <Badge className="bg-primary/20 text-primary border-0">{role}</Badge>
                  </div>
                )}

                <Link
                  to="/ai-companion"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-primary/5 hover:bg-primary/10 rounded-lg mx-2 transition-colors border border-primary/20"
                >
                  <span className="text-xl">✨</span>
                  <span className="font-body font-bold text-sm text-primary">AI Companion</span>
                </Link>

                <div className="flex flex-col gap-2 px-4 pt-3 border-t border-border mx-2">
                  {!role ? (
                    <>
                      <Link to="/login" onClick={() => setIsOpen(false)}>
                        <Button variant="outline" className="w-full border-primary text-primary">Login</Button>
                      </Link>
                      <Link to="/register" onClick={() => setIsOpen(false)}>
                        <Button className="w-full bg-gradient-primary text-primary-foreground">Donate / Register</Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                        <Button variant="outline" className="w-full border-primary text-primary gap-2">
                          <LayoutDashboard className="w-4 h-4" /> My Dashboard
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        onClick={() => { setIsOpen(false); handleAlertsOpen(); }}
                        className="w-full border-border font-body rounded-xl gap-2 justify-start"
                      >
                        <Bell className="w-4 h-4" /> Alerts
                        {unreadCount > 0 && (
                          <Badge className="ml-auto bg-primary text-primary-foreground text-xs border-0">{unreadCount}</Badge>
                        )}
                      </Button>
                      <Link to="/settings" onClick={() => setIsOpen(false)}>
                        <Button variant="outline" className="w-full border-border text-foreground gap-2">
                          <Settings className="w-4 h-4" /> Settings
                        </Button>
                      </Link>
                      <Button
                        onClick={handleLogout}
                        variant="ghost"
                        className="w-full text-red-500 hover:bg-red-50 gap-2"
                      >
                        <LogOut className="w-4 h-4" /> Logout
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
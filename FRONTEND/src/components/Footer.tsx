import { Link } from "react-router-dom";
import { Heart, Phone, Mail, MapPin, ExternalLink } from "lucide-react";

const modules = [
  { name: "BloodBridge", path: "/blood-bridge", emoji: "🩸" },
  { name: "ThalCare", path: "/thal-care", emoji: "💉" },
  { name: "PlateletAlert", path: "/platelet-alert", emoji: "⏱️" },
  { name: "MarrowMatch", path: "/marrow-match", emoji: "🧬" },
  { name: "LastGift", path: "/last-gift", emoji: "🫁" },
  { name: "MilkBridge", path: "/milk-bridge", emoji: "🍼" },
];

export default function Footer() {
  return (
    <footer className="bg-foreground text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Heart className="w-5 h-5 fill-current text-primary-foreground" />
              </div>
              <div>
                <div className="font-display font-bold text-lg">LifeForge</div>
                <div className="font-body text-xs text-accent font-semibold tracking-widest uppercase -mt-1">Connect</div>
              </div>
            </div>
            <p className="font-body text-sm text-primary-foreground/70 leading-relaxed">
              Transforming fragmented donation into a proactive ecosystem. Connecting donors with patients across India, instantly.
            </p>
            <div className="flex gap-3 mt-5">
              <div className="w-9 h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary transition-colors flex items-center justify-center cursor-pointer">
                <span className="text-sm">𝕏</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary transition-colors flex items-center justify-center cursor-pointer">
                <span className="text-sm">in</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary-foreground/10 hover:bg-primary transition-colors flex items-center justify-center cursor-pointer">
                <span className="text-sm">f</span>
              </div>
            </div>
          </div>

          {/* Modules */}
          <div>
            <h4 className="font-display font-bold text-base mb-5">Modules</h4>
            <ul className="space-y-3">
              {modules.map((m) => (
                <li key={m.path}>
                  <Link
                    to={m.path}
                    className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors flex items-center gap-2"
                  >
                    <span>{m.emoji}</span> {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-bold text-base mb-5">Quick Links</h4>
            <ul className="space-y-3">
              {[
                ["Register as Donor", "/register"],
                ["Register as Hospital", "/register?type=hospital"],
                ["Find Donors", "/blood-bridge"],
                ["Dashboard", "/dashboard"],
                ["Verification Process", "/register"],
                ["Trust Score System", "/dashboard"],
              ].map(([label, path]) => (
                <li key={label}>
                  <Link
                    to={path}
                    className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-base mb-5">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                <div>
                  <div className="font-body text-sm font-semibold">Emergency Helpline</div>
                  <div className="font-body text-sm text-primary-foreground/70">1800-XXX-LIFE (24/7)</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                <div>
                  <div className="font-body text-sm font-semibold">Support</div>
                  <div className="font-body text-sm text-primary-foreground/70">help@lifeforgeconnect.in</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                <div>
                  <div className="font-body text-sm font-semibold">HQ</div>
                  <div className="font-body text-sm text-primary-foreground/70">Bengaluru, Karnataka, India</div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-body text-sm text-primary-foreground/50">
            © 2025 LifeForge Connect. All rights reserved. Made with ❤️ in India.
          </p>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms of Service", "DPDP Compliance"].map((link) => (
              <a key={link} href="#" className="font-body text-sm text-primary-foreground/50 hover:text-accent transition-colors">
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

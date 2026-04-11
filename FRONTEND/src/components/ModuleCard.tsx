import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface ModuleCardProps {
  emoji: string;
  name: string;
  tagline: string;
  description: string;
  path: string;
  color: string;
  bgColor: string;
  borderColor: string;
  stats: string;
  index: number;
}

export default function ModuleCard({
  emoji,
  name,
  tagline,
  description,
  path,
  color,
  bgColor,
  borderColor,
  stats,
  index,
}: ModuleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <Link to={path} className="block h-full">
        <div
          className={`module-card h-full rounded-2xl border-2 ${borderColor} bg-card shadow-card overflow-hidden group cursor-pointer`}
        >
          {/* Top accent bar */}
          <div className={`h-1.5 ${bgColor} w-full`} />

          <div className="p-6">
            {/* Icon + badge */}
            <div className="flex items-start justify-between mb-4">
              <div className={`w-16 h-16 rounded-2xl ${bgColor} bg-opacity-15 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300`}>
                <span className="filter drop-shadow-sm">{emoji}</span>
              </div>
              <span className={`font-body text-xs font-bold px-3 py-1.5 rounded-full ${bgColor} bg-opacity-15 ${color}`}>
                {stats}
              </span>
            </div>

            {/* Name + tagline */}
            <h3 className={`font-display font-bold text-xl text-foreground group-hover:${color} transition-colors duration-200`}>
              {name}
            </h3>
            <p className={`font-body text-xs font-semibold uppercase tracking-wider ${color} mt-0.5 mb-3`}>
              {tagline}
            </p>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>

            {/* CTA */}
            <div className={`flex items-center gap-1.5 mt-5 ${color} font-body text-sm font-semibold group-hover:gap-3 transition-all duration-200`}>
              Explore Module <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

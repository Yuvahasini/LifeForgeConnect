import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

interface LiveCounterProps {
  end: number;
  label: string;
  suffix?: string;
  prefix?: string;
  duration?: number;
  icon: string;
  color: string;
}

export default function LiveCounter({ end, label, suffix = "", prefix = "", duration = 2, icon, color }: LiveCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const animatingRef = useRef(false);

  useEffect(() => {
    if (!isInView || animatingRef.current) return;
    animatingRef.current = true;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = (now - startTime) / (duration * 1000);
      const progress = Math.min(elapsed, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, end, duration]);

  const formatted = count >= 1000 ? (count / 1000).toFixed(1) + "k" : count.toString();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center text-center p-6 rounded-2xl bg-card shadow-card border border-border group hover:shadow-primary-lg transition-all duration-300"
    >
      <div className={`text-4xl mb-3 group-hover:scale-110 transition-transform duration-300`}>{icon}</div>
      <div className={`font-display font-bold text-4xl md:text-5xl ${color}`}>
        {prefix}{formatted}{suffix}
      </div>
      <div className="font-body text-sm text-muted-foreground mt-2 font-medium">{label}</div>
      <div className="w-8 h-0.5 bg-gradient-primary rounded-full mt-3 group-hover:w-16 transition-all duration-300" />
    </motion.div>
  );
}

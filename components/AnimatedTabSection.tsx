"use client";

import { type ReactNode, type Ref } from "react";
import { motion } from "motion/react";

export default function AnimatedTabSection({
  className,
  children,
  sectionRef,
}: {
  className?: string;
  children: ReactNode;
  sectionRef?: Ref<HTMLElement>;
}) {
  return (
    <motion.section
      className={className}
      ref={sectionRef}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

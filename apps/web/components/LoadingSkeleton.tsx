'use client';

import { motion } from 'framer-motion';

export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="glass rounded-lg p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <div className="space-y-3">
            <div className="skeleton h-4 w-1/4 rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function SessionCardSkeleton() {
  return (
    <motion.div
      className="glass rounded-lg p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="space-y-4">
        <div className="skeleton h-6 w-1/3 rounded" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-1/4 rounded" />
                <div className="skeleton h-2 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

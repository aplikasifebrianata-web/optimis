import React from 'react';
import { motion } from 'motion/react';
import { NavTab } from '../../types/oppkpke';

interface DashboardSkeletonProps {
  activeTab?: NavTab;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  activeTab = 'dashboard',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="space-y-5"
    >
      {/* Top Hero Banner Shimmer (lavender-blue pill block just like Dashboard V18 00:00) */}
      <div className="rounded-3xl bg-white/90 border border-slate-200/70 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-3 flex-1 max-w-2xl">
            <div className="h-5 w-48 rounded-full v18-shimmer-block" />
            <div className="h-8 w-4/5 rounded-2xl v18-shimmer-block" />
            <div className="h-4 w-3/5 rounded-xl v18-shimmer-subtle" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-36 rounded-2xl v18-shimmer-block" />
            <div className="h-10 w-32 rounded-2xl v18-shimmer-subtle" />
          </div>
        </div>
      </div>

      {/* 4 KPI Stat Cards Shimmer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.18 }}
            className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs flex items-start gap-4"
          >
            <div className="w-12 h-12 rounded-2xl v18-shimmer-block shrink-0" />
            <div className="space-y-2.5 flex-1">
              <div className="h-3.5 w-28 rounded-lg v18-shimmer-subtle" />
              <div className="h-7 w-36 rounded-xl v18-shimmer-block" />
              <div className="h-3 w-24 rounded-lg v18-shimmer-subtle" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Bento Grid Shimmer */}
      {activeTab === 'dashboard' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/70 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-36 rounded-lg v18-shimmer-block" />
                  <div className="h-3.5 w-56 rounded-lg v18-shimmer-subtle" />
                </div>
                <div className="h-8 w-52 rounded-xl v18-shimmer-subtle" />
              </div>
              <div className="h-60 w-full rounded-2xl v18-shimmer-block" />
            </div>

            <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/70 p-6 space-y-4 shadow-xs">
              <div className="h-5 w-36 rounded-lg v18-shimmer-block" />
              <div className="space-y-3.5 pt-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full v18-shimmer-block shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 w-3/4 rounded-lg v18-shimmer-subtle" />
                      <div className="h-2.5 w-1/2 rounded-lg v18-shimmer-subtle" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 space-y-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-2xl v18-shimmer-subtle" />
            ))}
          </div>
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-14 w-full rounded-2xl v18-shimmer-block" />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

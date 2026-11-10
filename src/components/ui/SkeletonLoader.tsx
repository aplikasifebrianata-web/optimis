import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
          <div
            key={item}
            className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3"
          >
            <div className="h-3.5 w-28 bg-slate-200 rounded" />
            <div className="h-7 w-36 bg-slate-200 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 h-80 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-4 w-48 bg-slate-200 rounded" />
            <div className="h-3 w-64 bg-slate-100 rounded" />
          </div>
          <div className="h-56 w-full bg-slate-100 rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 h-80 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-4 w-48 bg-slate-200 rounded" />
            <div className="h-3 w-64 bg-slate-100 rounded" />
          </div>
          <div className="h-56 w-full bg-slate-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

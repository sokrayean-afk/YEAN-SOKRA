import {
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  ListOrdered,
  Plus,
} from 'lucide-react';
import type { ViewTab } from '../types/finance';

interface MobileBottomNavProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  onOpenNewTx: () => void;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenNewTx,
}: MobileBottomNavProps) {
  const renderTab = (
    id: ViewTab,
    label: string,
    Icon: typeof LayoutDashboard
  ) => {
    const isActive = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => onSelectTab(id)}
        className={`flex flex-col items-center justify-center min-h-[48px] w-full transition-colors ${
          isActive ? 'text-teal-700' : 'text-slate-500 hover:text-slate-900'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
        <span className={`text-[11px] mt-1 leading-none whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <nav
      aria-label="ការរុករកទូរស័ព្ទ"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
    >
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {renderTab('overview', 'ទូទៅ', LayoutDashboard)}
        {renderTab('ledger', 'កំណត់ត្រា', ListOrdered)}

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onOpenNewTx}
            aria-label="កត់ត្រាចំណូលចំណាយថ្មី"
            className="w-12 h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white shadow-md shadow-teal-900/15 flex items-center justify-center transition-transform"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {renderTab('analytics', 'វិភាគ', BarChart3)}
        {renderTab('settings', 'កំណត់', CalendarClock)}
      </div>
    </nav>
  );
}

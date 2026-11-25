import type { User } from 'firebase/auth';
import {
  BarChart3,
  Bell,
  CalendarClock,
  Cloud,
  LayoutDashboard,
  ListOrdered,
} from 'lucide-react';
import type {
  ActiveUser,
  CurrencyCode,
  CycleRange,
  HouseholdSettings,
  ViewTab,
} from '../types/finance';

interface SidebarProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  settings: HouseholdSettings;
  activeCycle: CycleRange;
  onActiveUserChange: (user: ActiveUser) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
  googleUser: User | null;
  hasDriveToken: boolean;
  onOpenDriveModal: () => void;
  reminderCount: number;
  onOpenNotifications: () => void;
}

const NAV_ITEMS: { id: ViewTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'ទិដ្ឋភាពទូទៅ', icon: LayoutDashboard },
  { id: 'ledger', label: 'កត់ត្រាចំណូលចំណាយ', icon: ListOrdered },
  { id: 'analytics', label: 'វិភាគទិន្នន័យ', icon: BarChart3 },
  { id: 'settings', label: 'ថវិកា និងថ្ងៃកំណត់', icon: CalendarClock },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  settings,
  activeCycle,
  onActiveUserChange,
  onCurrencyChange,
  googleUser,
  hasDriveToken,
  onOpenDriveModal,
  reminderCount,
  onOpenNotifications,
}: SidebarProps) {
  const husbandLabel = settings.husbandName.trim() || 'ប្តី';
  const wifeLabel = settings.wifeName.trim() || 'ប្រពន្ធ';

  return (
    <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
      <div className="flex h-full flex-col bg-white border-r border-slate-200">
        <div className="flex items-center h-16 px-6 border-b border-slate-200">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap truncate">
            គណនីគ្រួសារ
          </span>
        </div>

        {/* Active User Switcher (2 Users: Husband / Wife) */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-[11px] font-medium text-slate-500 mb-1.5">
            អ្នកប្រើប្រាស់កំពុងប្រើ
          </div>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => onActiveUserChange('husband')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors truncate ${
                settings.activeUser === 'husband'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {husbandLabel}
            </button>
            <button
              type="button"
              onClick={() => onActiveUserChange('wife')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors truncate ${
                settings.activeUser === 'wife'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {wifeLabel}
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-1" aria-label="ការរុករកចម្បង">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors text-left whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-teal-700' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          {/* Bill Reminders / Notifications shortcut */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-left rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Bell
                className={`w-4 h-4 shrink-0 ${
                  reminderCount > 0 ? 'text-amber-700' : 'text-slate-400'
                }`}
              />
              <span className="text-xs font-semibold text-slate-800 truncate">
                ការជូនដំណឹងវិក្កយបត្រ
              </span>
            </span>
            {reminderCount > 0 && (
              <span className="text-xs font-bold num-tabular text-red-600 shrink-0">
                {reminderCount}
              </span>
            )}
          </button>

          {/* Online Cloud Sync & Drive shortcut */}
          <button
            type="button"
            onClick={onOpenDriveModal}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Cloud
              className={`w-4 h-4 shrink-0 ${
                googleUser || hasDriveToken ? 'text-teal-700' : 'text-slate-400'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-800 truncate">
                {googleUser ? 'អនឡាញ · គ្រប់ឧបករណ៍' : 'ភ្ជាប់អនឡាញ (Cloud)'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {googleUser
                  ? googleUser.email || 'កំពុងធ្វើសមកាលកម្ម'
                  : 'ចុចដើម្បីប្រើលើគ្រប់ឧបករណ៍'}
              </div>
            </div>
          </button>

          {/* Currency Display Toggle */}
          <div className="space-y-1">
            <div className="text-xs text-slate-500">រូបិយប័ណ្ណបង្ហាញ</div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onCurrencyChange('USD')}
                className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  settings.displayCurrency === 'USD'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ដុល្លារ ($)
              </button>
              <button
                type="button"
                onClick={() => onCurrencyChange('KHR')}
                className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  settings.displayCurrency === 'KHR'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                រៀល (៛)
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1 text-xs">
            <div className="font-medium text-slate-800 truncate">
              {settings.householdName}
            </div>
            <div className="text-slate-500">
              {settings.cycleMode === 'custom_range'
                ? 'រយៈពេលកំណត់ដោយខ្លួនឯង'
                : `វដ្តចាប់ផ្តើមថ្ងៃទី ${settings.cycleStartDay}`}
            </div>
            <div className="text-slate-500 truncate">{activeCycle.label}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

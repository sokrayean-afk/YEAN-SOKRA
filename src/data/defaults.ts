import type {
  Category,
  HouseholdSettings,
  RecurringBill,
  Transaction,
} from '../types/finance';
import { getCycleRange, getTodayIso, parseIsoDate, toIsoDate } from '../utils/cycle';

export const DEFAULT_CATEGORIES: Category[] = [
  // Expense categories
  { id: 'food', name: 'ម្ហូបអាហារ និងផ្សារ', type: 'expense', color: '#0F766E' },
  { id: 'utilities', name: 'ទឹក ភ្លើង និងអ៊ីនធឺណិត', type: 'expense', color: '#0369A1' },
  { id: 'housing', name: 'ថ្លៃផ្ទះ / បង់រំលស់', type: 'expense', color: '#334155' },
  { id: 'transport', name: 'សាំង និងការធ្វើដំណើរ', type: 'expense', color: '#B45309' },
  { id: 'education', name: 'ការសិក្សាកូន', type: 'expense', color: '#4338CA' },
  { id: 'health', name: 'សុខភាព និងថ្នាំពេទ្យ', type: 'expense', color: '#BE123C' },
  { id: 'home_goods', name: 'សម្ភារៈក្នុងផ្ទះ', type: 'expense', color: '#6D28D9' },
  { id: 'social', name: 'ចងដៃ និងកម្សាន្ត', type: 'expense', color: '#C2410C' },
  { id: 'other_exp', name: 'ចំណាយផ្សេងៗ', type: 'expense', color: '#64748B' },

  // Income categories
  { id: 'salary', name: 'ប្រាក់ខែប្រចាំខែ', type: 'income', color: '#15803D' },
  { id: 'business', name: 'ចំណូលអាជីវកម្ម / លក់ដូរ', type: 'income', color: '#0F766E' },
  { id: 'bonus', name: 'ប្រាក់បន្ថែម / ភាគលាភ', type: 'income', color: '#0369A1' },
  { id: 'other_inc', name: 'ចំណូលផ្សេងៗ', type: 'income', color: '#475569' },
];

const initialMonthCycle = getCycleRange(1, 0, getTodayIso());

export const DEFAULT_SETTINGS: HouseholdSettings = {
  householdName: 'គ្រួសារយើង',
  husbandName: 'ប្តី',
  wifeName: 'ប្រពន្ធ',
  activeUser: 'husband',
  cycleMode: 'monthly_day',
  cycleStartDay: 1,
  customStartDate: initialMonthCycle.startDate,
  customEndDate: initialMonthCycle.endDate,
  displayCurrency: 'USD',
  exchangeRate: 4050,
  monthlyBudgetTargetUsd: 1150,
  notificationsEnabled: true,
  reminderDaysBefore: 5,
  browserNotificationsEnabled: false,
  categoryBudgets: {
    food: 360,
    utilities: 110,
    housing: 320,
    transport: 95,
    education: 120,
    health: 60,
    home_goods: 80,
    social: 85,
  },
};

function offsetDateFrom(baseIso: string, deltaDays: number): string {
  const d = parseIsoDate(baseIso);
  d.setDate(d.getDate() + deltaDays);
  return toIsoDate(d);
}

function clampDateToToday(dateIso: string, todayIso: string): string {
  return dateIso > todayIso ? todayIso : dateIso;
}

export function createSeedData(): {
  transactions: Transaction[];
  bills: RecurringBill[];
} {
  const todayIso = getTodayIso();
  const c0 = getCycleRange(1, 0, todayIso);
  const c1 = getCycleRange(1, -1, todayIso);
  const c2 = getCycleRange(1, -2, todayIso);

  const txList: Transaction[] = [];
  let seq = 1;

  const pushTx = (
    cycleStart: string,
    dayOffset: number,
    data: Omit<Transaction, 'id' | 'date' | 'createdAt' | 'originalAmount' | 'originalCurrency'> & {
      originalCurrency?: 'USD' | 'KHR';
    }
  ) => {
    const rawDate = offsetDateFrom(cycleStart, dayOffset);
    // Avoid generating future transactions beyond today
    if (rawDate > todayIso) return;
    const currency = data.originalCurrency || 'USD';
    const originalAmount =
      currency === 'KHR' ? Math.round(data.amountUsd * 4050) : data.amountUsd;

    txList.push({
      id: `seed-tx-${seq++}`,
      type: data.type,
      amountUsd: Number(data.amountUsd.toFixed(2)),
      originalAmount,
      originalCurrency: currency,
      categoryId: data.categoryId,
      date: clampDateToToday(rawDate, todayIso),
      paymentMethod: data.paymentMethod,
      member: data.member,
      note: data.note,
      billId: data.billId,
      createdAt: `${rawDate}T09:00:00.000Z`,
    });
  };

  // Cycle -2 (2 months ago)
  pushTx(c2.startDate, 0, {
    type: 'income',
    amountUsd: 1050,
    categoryId: 'salary',
    paymentMethod: 'aba',
    member: 'husband',
    note: 'ប្រាក់ខែប្រចាំខែ',
  });
  pushTx(c2.startDate, 2, {
    type: 'income',
    amountUsd: 680,
    categoryId: 'salary',
    paymentMethod: 'acleda',
    member: 'wife',
    note: 'ប្រាក់ខែប្រចាំខែ',
  });
  pushTx(c2.startDate, 1, {
    type: 'expense',
    amountUsd: 320,
    categoryId: 'housing',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'បង់រំលស់ផ្ទះប្រចាំខែ',
    billId: 'bill-housing',
  });
  pushTx(c2.startDate, 4, {
    type: 'expense',
    amountUsd: 25,
    categoryId: 'utilities',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ថ្លៃអ៊ីនធឺណិត Wi-Fi ផ្ទះ',
    billId: 'bill-wifi',
  });
  pushTx(c2.startDate, 6, {
    type: 'expense',
    amountUsd: 118,
    categoryId: 'food',
    paymentMethod: 'cash',
    member: 'wife',
    note: 'ទិញម្ហូប និងអង្ករដើមខែ',
    originalCurrency: 'KHR',
  });
  pushTx(c2.startDate, 9, {
    type: 'expense',
    amountUsd: 54.5,
    categoryId: 'utilities',
    paymentMethod: 'aba',
    member: 'husband',
    note: 'បង់ថ្លៃភ្លើង EDC',
    billId: 'bill-edc',
  });
  pushTx(c2.startDate, 12, {
    type: 'expense',
    amountUsd: 115,
    categoryId: 'education',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ថ្លៃសាលា និងឡានសាលាកូន',
    billId: 'bill-school',
  });
  pushTx(c2.startDate, 14, {
    type: 'expense',
    amountUsd: 14.2,
    categoryId: 'utilities',
    paymentMethod: 'aba',
    member: 'wife',
    note: 'បង់ថ្លៃទឹកស្អាត',
    billId: 'bill-water',
  });
  pushTx(c2.startDate, 16, {
    type: 'expense',
    amountUsd: 112,
    categoryId: 'food',
    paymentMethod: 'cash',
    member: 'wife',
    note: 'ម្ហូបផ្សារ និងផ្លែឈើពាក់កណ្តាលខែ',
    originalCurrency: 'KHR',
  });
  pushTx(c2.startDate, 19, {
    type: 'expense',
    amountUsd: 64,
    categoryId: 'transport',
    paymentMethod: 'cash',
    member: 'husband',
    note: 'ចាក់សាំងរថយន្ត និងម៉ូតូ',
  });
  pushTx(c2.startDate, 22, {
    type: 'expense',
    amountUsd: 95,
    categoryId: 'food',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ទិញទំនិញផ្សារទំនើប',
  });
  pushTx(c2.startDate, 25, {
    type: 'expense',
    amountUsd: 48,
    categoryId: 'home_goods',
    paymentMethod: 'aba',
    member: 'wife',
    note: 'សាប៊ូ ក្រដាសជូតមាត់ និងសម្ភារៈផ្ទះបាយ',
  });
  pushTx(c2.startDate, 27, {
    type: 'expense',
    amountUsd: 55,
    categoryId: 'social',
    paymentMethod: 'cash',
    member: 'joint',
    note: 'ចងដៃមិត្តភក្តិ និងហូបអាហារគ្រួសារ',
  });

  // Cycle -1 (Last month)
  pushTx(c1.startDate, 0, {
    type: 'income',
    amountUsd: 1050,
    categoryId: 'salary',
    paymentMethod: 'aba',
    member: 'husband',
    note: 'ប្រាក់ខែប្រចាំខែ',
  });
  pushTx(c1.startDate, 1, {
    type: 'income',
    amountUsd: 700,
    categoryId: 'salary',
    paymentMethod: 'acleda',
    member: 'wife',
    note: 'ប្រាក់ខែប្រចាំខែ',
  });
  pushTx(c1.startDate, 14, {
    type: 'income',
    amountUsd: 190,
    categoryId: 'business',
    paymentMethod: 'aba',
    member: 'wife',
    note: 'ចំណូលលក់អនឡាញបន្ថែម',
  });
  pushTx(c1.startDate, 1, {
    type: 'expense',
    amountUsd: 320,
    categoryId: 'housing',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'បង់រំលស់ផ្ទះប្រចាំខែ',
    billId: 'bill-housing',
  });
  pushTx(c1.startDate, 4, {
    type: 'expense',
    amountUsd: 25,
    categoryId: 'utilities',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ថ្លៃអ៊ីនធឺណិត Wi-Fi ផ្ទះ',
    billId: 'bill-wifi',
  });
  pushTx(c1.startDate, 5, {
    type: 'expense',
    amountUsd: 124,
    categoryId: 'food',
    paymentMethod: 'cash',
    member: 'wife',
    note: 'ទិញម្ហូបផ្សារ និងគ្រឿងទេស',
    originalCurrency: 'KHR',
  });
  pushTx(c1.startDate, 9, {
    type: 'expense',
    amountUsd: 62.4,
    categoryId: 'utilities',
    paymentMethod: 'aba',
    member: 'husband',
    note: 'បង់ថ្លៃភ្លើង EDC',
    billId: 'bill-edc',
  });
  pushTx(c1.startDate, 11, {
    type: 'expense',
    amountUsd: 115,
    categoryId: 'education',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ថ្លៃសាលា និងឡានសាលាកូន',
    billId: 'bill-school',
  });
  pushTx(c1.startDate, 14, {
    type: 'expense',
    amountUsd: 13.8,
    categoryId: 'utilities',
    paymentMethod: 'aba',
    member: 'wife',
    note: 'បង់ថ្លៃទឹកស្អាត',
    billId: 'bill-water',
  });
  pushTx(c1.startDate, 15, {
    type: 'expense',
    amountUsd: 42,
    categoryId: 'health',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ពិនិត្យសុខភាព និងទិញវីតាមីន',
  });
  pushTx(c1.startDate, 17, {
    type: 'expense',
    amountUsd: 108,
    categoryId: 'food',
    paymentMethod: 'cash',
    member: 'wife',
    note: 'ម្ហូបប្រចាំសប្តាហ៍ និងផ្លែឈើ',
    originalCurrency: 'KHR',
  });
  pushTx(c1.startDate, 20, {
    type: 'expense',
    amountUsd: 78,
    categoryId: 'transport',
    paymentMethod: 'cash',
    member: 'husband',
    note: 'សាំង និងប្តូរប្រេងម៉ាស៊ីន',
  });
  pushTx(c1.startDate, 23, {
    type: 'expense',
    amountUsd: 105,
    categoryId: 'food',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ផ្សារទំនើប និងទឹកដោះគោកូន',
  });
  pushTx(c1.startDate, 26, {
    type: 'expense',
    amountUsd: 72,
    categoryId: 'social',
    paymentMethod: 'cash',
    member: 'joint',
    note: 'ចងដៃការ និងអាហារជួបជុំគ្រួសារ',
  });

  // Current Cycle (c0)
  pushTx(c0.startDate, 0, {
    type: 'income',
    amountUsd: 1080,
    categoryId: 'salary',
    paymentMethod: 'aba',
    member: 'husband',
    note: 'ប្រាក់ខែប្រចាំខែ',
  });
  pushTx(c0.startDate, 1, {
    type: 'income',
    amountUsd: 720,
    categoryId: 'salary',
    paymentMethod: 'acleda',
    member: 'wife',
    note: 'ប្រាក់ខែប្រចាំខែ',
  });
  pushTx(c0.startDate, 12, {
    type: 'income',
    amountUsd: 215,
    categoryId: 'business',
    paymentMethod: 'aba',
    member: 'wife',
    note: 'ចំណូលបន្ថែមពីការលក់ទំនិញ',
  });
  pushTx(c0.startDate, 1, {
    type: 'expense',
    amountUsd: 320,
    categoryId: 'housing',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'បង់រំលស់ផ្ទះប្រចាំខែ',
    billId: 'bill-housing',
  });
  pushTx(c0.startDate, 3, {
    type: 'expense',
    amountUsd: 48.5,
    categoryId: 'food',
    paymentMethod: 'cash',
    member: 'wife',
    note: 'ទិញអង្ករ ត្រីសាច់ និងបន្លែ',
    originalCurrency: 'KHR',
  });
  pushTx(c0.startDate, 4, {
    type: 'expense',
    amountUsd: 25,
    categoryId: 'utilities',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ថ្លៃអ៊ីនធឺណិត Wi-Fi ផ្ទះ',
    billId: 'bill-wifi',
  });
  pushTx(c0.startDate, 6, {
    type: 'expense',
    amountUsd: 34,
    categoryId: 'transport',
    paymentMethod: 'cash',
    member: 'husband',
    note: 'ចាក់សាំងរថយន្តពេញធុង',
  });
  pushTx(c0.startDate, 8, {
    type: 'expense',
    amountUsd: 52,
    categoryId: 'food',
    paymentMethod: 'aba',
    member: 'wife',
    note: 'ទិញទំនិញផ្សារទំនើប Makro',
  });
  pushTx(c0.startDate, 9, {
    type: 'expense',
    amountUsd: 58.6,
    categoryId: 'utilities',
    paymentMethod: 'aba',
    member: 'husband',
    note: 'បង់ថ្លៃភ្លើង EDC',
    billId: 'bill-edc',
  });
  pushTx(c0.startDate, 11, {
    type: 'expense',
    amountUsd: 115,
    categoryId: 'education',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ថ្លៃសាលា និងឡានសាលាកូន',
    billId: 'bill-school',
  });
  pushTx(c0.startDate, 13, {
    type: 'expense',
    amountUsd: 61,
    categoryId: 'food',
    paymentMethod: 'cash',
    member: 'wife',
    note: 'ម្ហូបផ្សារ និងផ្លែឈើប្រចាំសប្តាហ៍',
    originalCurrency: 'KHR',
  });
  pushTx(c0.startDate, 15, {
    type: 'expense',
    amountUsd: 28,
    categoryId: 'health',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ទិញថ្នាំ និងសម្ភារៈសុខភាព',
  });
  pushTx(c0.startDate, 17, {
    type: 'expense',
    amountUsd: 46.5,
    categoryId: 'home_goods',
    paymentMethod: 'aba',
    member: 'wife',
    note: 'សម្ភារៈសម្អាត និងប្រដាប់ផ្ទះបាយ',
  });
  pushTx(c0.startDate, 19, {
    type: 'expense',
    amountUsd: 38,
    categoryId: 'transport',
    paymentMethod: 'wing',
    member: 'husband',
    note: 'ចាក់សាំង និងលាងឡាន',
  });
  pushTx(c0.startDate, 20, {
    type: 'expense',
    amountUsd: 76,
    categoryId: 'food',
    paymentMethod: 'aba',
    member: 'joint',
    note: 'ទឹកដោះគោ នំ និងម្ហូបប្រចាំសប្តាហ៍',
  });
  pushTx(c0.startDate, 22, {
    type: 'expense',
    amountUsd: 65,
    categoryId: 'social',
    paymentMethod: 'cash',
    member: 'joint',
    note: 'ចងដៃពិធីមង្គលការមិត្តភក្តិ',
  });

  const bills: RecurringBill[] = [
    {
      id: 'bill-housing',
      title: 'បង់រំលស់ផ្ទះប្រចាំខែ',
      categoryId: 'housing',
      amountUsd: 320,
      dueDay: 2,
      paymentMethod: 'aba',
      note: 'ផ្ទេរតាម ABA ទៅធនាគារ',
      paidCycles: { [c0.key]: 'seed-paid-housing', [c1.key]: 'seed-paid-housing-1' },
    },
    {
      id: 'bill-wifi',
      title: 'ថ្លៃអ៊ីនធឺណិត Wi-Fi ផ្ទះ',
      categoryId: 'utilities',
      amountUsd: 25,
      dueDay: 5,
      paymentMethod: 'aba',
      note: 'កញ្ចប់អ៊ីនធឺណិតប្រចាំខែ',
      paidCycles: { [c0.key]: 'seed-paid-wifi', [c1.key]: 'seed-paid-wifi-1' },
    },
    {
      id: 'bill-edc',
      title: 'ថ្លៃភ្លើង EDC',
      categoryId: 'utilities',
      amountUsd: 58,
      dueDay: 10,
      paymentMethod: 'aba',
      note: 'បង់តាម ABA Bill Payment',
      paidCycles: { [c0.key]: 'seed-paid-edc', [c1.key]: 'seed-paid-edc-1' },
    },
    {
      id: 'bill-school',
      title: 'ថ្លៃសាលា និងឡានសាលាកូន',
      categoryId: 'education',
      amountUsd: 115,
      dueDay: 12,
      paymentMethod: 'aba',
      note: 'បង់រៀងរាល់ដើមខែ',
      paidCycles: { [c0.key]: 'seed-paid-school', [c1.key]: 'seed-paid-school-1' },
    },
    {
      id: 'bill-water',
      title: 'ថ្លៃទឹកស្អាត PPWSA',
      categoryId: 'utilities',
      amountUsd: 15,
      dueDay: 26,
      paymentMethod: 'aba',
      note: 'កំណត់ថ្ងៃបង់ទី 26 រៀងរាល់ខែ',
      paidCycles: { [c1.key]: 'seed-paid-water-1' },
    },
    {
      id: 'bill-trash',
      title: 'ថ្លៃសំរាម និងសន្តិសុខបុរី',
      categoryId: 'home_goods',
      amountUsd: 18,
      dueDay: 28,
      paymentMethod: 'cash',
      note: 'បង់ជូនការិយាល័យបុរី',
      paidCycles: { [c1.key]: 'seed-paid-trash-1' },
    },
  ];

  return { transactions: txList, bills };
}

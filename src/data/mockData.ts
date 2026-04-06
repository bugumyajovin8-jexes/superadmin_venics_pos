export const mrrData = [
  { name: "Jan", mrr: 45000, target: 40000 },
  { name: "Feb", mrr: 52000, target: 45000 },
  { name: "Mar", mrr: 48000, target: 50000 },
  { name: "Apr", mrr: 61000, target: 55000 },
  { name: "May", mrr: 65000, target: 60000 },
  { name: "Jun", mrr: 72000, target: 65000 },
  { name: "Jul", mrr: 84000, target: 70000 },
];

export const deviceUsageData = [
  { name: "Desktop", value: 45 },
  { name: "Mobile", value: 35 },
  { name: "Tablet", value: 20 },
];

export const topMerchantsData = [
  { name: "Coffee Co", sales: 12500 },
  { name: "Burger Joint", sales: 9800 },
  { name: "Tech Store", sales: 8500 },
  { name: "Book Haven", sales: 7200 },
  { name: "Fitness Gear", sales: 6100 },
];

export const retentionData = [
  { name: "Week 1", rate: 95 },
  { name: "Week 2", rate: 85 },
  { name: "Week 3", rate: 75 },
  { name: "Week 4", rate: 70 },
  { name: "Week 8", rate: 65 },
  { name: "Week 12", rate: 60 },
];

export const alertsData = [
  { id: 1, type: "warning", message: "Sudden increase in churn detected in EU region.", time: "2 hours ago" },
  { id: 2, type: "error", message: "Payment gateway API response time > 2000ms.", time: "5 hours ago" },
  { id: 3, type: "info", message: "New feature 'Inventory Sync' usage spiked by 45%.", time: "1 day ago" },
  { id: 4, type: "warning", message: "15 merchants inactive for more than 7 days.", time: "1 day ago" },
];

export const shopsData = [
  { id: "SH-001", name: "The Daily Grind", owner: "Alice Smith", plan: "Pro", status: "Active", license_expiry: "2026-12-31", mrr: 199 },
  { id: "SH-002", name: "Urban Bites", owner: "Bob Johnson", plan: "Enterprise", status: "Active", license_expiry: "2026-08-15", mrr: 499 },
  { id: "SH-003", name: "Tech Haven", owner: "Charlie Davis", plan: "Basic", status: "Blocked", license_expiry: "2026-01-10", mrr: 49 },
  { id: "SH-004", name: "Green Grocers", owner: "Diana Evans", plan: "Pro", status: "Active", license_expiry: "2026-11-20", mrr: 199 },
  { id: "SH-005", name: "Fit & Active", owner: "Evan Wright", plan: "Basic", status: "Active", license_expiry: "2026-05-05", mrr: 49 },
  { id: "SH-006", name: "Bookworm Corner", owner: "Fiona Lee", plan: "Pro", status: "Active", license_expiry: "2026-09-30", mrr: 199 },
  { id: "SH-007", name: "Auto Parts Plus", owner: "George Harris", plan: "Enterprise", status: "Active", license_expiry: "2027-02-28", mrr: 499 },
  { id: "SH-008", name: "Beauty Studio", owner: "Hannah Clark", plan: "Basic", status: "Blocked", license_expiry: "2025-12-01", mrr: 49 },
];

export const peakSalesData = [
  { time: "06:00", sales: 120 },
  { time: "09:00", sales: 450 },
  { time: "12:00", sales: 890 },
  { time: "15:00", sales: 650 },
  { time: "18:00", sales: 1100 },
  { time: "21:00", sales: 340 },
];

export const systemHealthData = [
  { time: "00:00", uptime: 99.99, apiResponse: 120, errors: 2 },
  { time: "04:00", uptime: 99.99, apiResponse: 115, errors: 1 },
  { time: "08:00", uptime: 99.98, apiResponse: 180, errors: 15 },
  { time: "12:00", uptime: 99.95, apiResponse: 250, errors: 45 },
  { time: "16:00", uptime: 99.97, apiResponse: 190, errors: 12 },
  { time: "20:00", uptime: 99.99, apiResponse: 130, errors: 3 },
];

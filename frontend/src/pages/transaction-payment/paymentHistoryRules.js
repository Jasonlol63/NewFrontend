// Payment History: sample rows. UI only for now: every account shows the same sample list.

// [cr/dr, balance, description]; all Contra, MYR, 13/03/2026, remark STARTING BALANCE, creater APPLE.
const SAMPLE = [
  [-7180.59, -7180.59, "CONTRA FROM 717A"], [-39239.71, -46420.3, "CONTRA FROM 717A-API"], [-25935.77, -72356.07, "CONTRA FROM BZ-028"],
  [-547.65, -72903.72, "CONTRA FROM BZ-029"], [-7277.05, -80180.77, "CONTRA FROM DREAMCMYR"], [-4777.14, -84957.91, "CONTRA FROM GALAXY683"],
  [-929.47, -85887.38, "CONTRA FROM GSC"], [748.73, -85138.65, "CONTRA TO JB-8852"], [473.86, -84664.79, "CONTRA TO JB-BOY"],
  [-33.77, -84698.56, "CONTRA FROM JB-D.KENNY"], [-390.36, -85088.92, "CONTRA FROM JB-FM"], [-354.67, -85443.59, "CONTRA FROM JB-HAOYE"],
  [15590.15, -69853.44, "CONTRA TO JB-JORDAN"], [-0.01, -69853.45, "CONTRA FROM JB-KAILUN"], [-56172.04, -126025.49, "CONTRA FROM JB-KENZO"],
  [7600.72, -118424.77, "CONTRA TO JB-MOK"], [-34.5, -118459.27, "CONTRA FROM JB-NIAN"], [-99.6, -118558.87, "CONTRA FROM JB-NIAN4"],
  [-54556.98, -173115.85, "CONTRA FROM JB-TEO"], [51.03, -173064.82, "CONTRA TO JB-WEIHONG"], [-1686.02, -174750.84, "CONTRA FROM JB-XIONG"],
  [-1222.21, -175973.05, "CONTRA FROM JB-YAO"], [-3771.25, -179744.3, "CONTRA FROM JERRY"], [-5136.73, -184881.03, "CONTRA FROM KAYA86"],
  [-180.79, -185061.82, "CONTRA FROM KL-BN"], [-49.92, -185111.74, "CONTRA FROM KL-CLH"], [-910.03, -186021.77, "CONTRA FROM KL-DEVIL"],
  [-628.54, -186650.31, "CONTRA FROM KL-JOHN2"], [-24.1, -186674.41, "CONTRA FROM KL-KEN"], [-976.91, -187651.32, "CONTRA FROM KL-MAX"],
  [1715.49, -185935.83, "CONTRA TO KL-RICKY"], [66582.56, -119353.27, "CONTRA TO KL-WANSHUN"], [-114992.31, -234345.58, "CONTRA FROM KZ"],
  [-28.62, -234374.2, "CONTRA FROM MARIO"], [-16026.76, -250400.96, "CONTRA FROM MAXBET-A95"],
];

export const HISTORY_ROWS = SAMPLE.map(([crdr, balance, description], i) => ({
  key: i,
  date: "13/03/2026",
  product: "CONTRA",
  currency: "MYR",
  rate: "-",
  winLoss: "-",
  crdr,
  balance,
  description,
  remark: "STARTING BALANCE",
  creater: "APPLE",
}));

// Opens the history of one account in its own browser window (a popup window, not a tab), about 85% of the screen and
// centred. Clicking the same account again brings its window to the front instead of opening another one.
export function openPaymentHistory(account) {
  const w = Math.min(1360, Math.round(window.screen.availWidth * 0.85));
  const h = Math.min(900, Math.round(window.screen.availHeight * 0.85));
  const left = Math.round((window.screen.availWidth - w) / 2);
  const top = Math.round((window.screen.availHeight - h) / 2);
  const win = window.open(
    `/transaction-payment/history/${encodeURIComponent(account)}`,
    `payment-history-${account}`,
    `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
  win?.focus();
}

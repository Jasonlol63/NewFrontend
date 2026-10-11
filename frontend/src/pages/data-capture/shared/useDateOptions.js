import { useEffect, useMemo, useState } from "react";
import { dateOptions, todayValue } from "./dataCaptureRules";

/**
 * The Date options (six days back to six days ahead of today) and today's value. They move on by themselves when the
 * date changes while the page is open: a timer fires just after midnight.
 */
export function useDateOptions() {
  const [today, setToday] = useState(() => todayValue());

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const timer = setTimeout(() => setToday(todayValue()), midnight - now);
    return () => clearTimeout(timer);
  }, [today]);

  const dates = useMemo(() => dateOptions(), [today]); // eslint-disable-line react-hooks/exhaustive-deps -- today only says when to rebuild
  return { dates, today };
}

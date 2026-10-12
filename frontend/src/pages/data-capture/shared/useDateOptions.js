import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { dateOptions, todayValue } from "./dataCaptureRules";

/**
 * The Date options (six days back to six days ahead of today) and today's value. They move on by themselves when the
 * date changes while the page is open: a timer fires just after midnight. The weekday in each label follows the page language.
 */
export function useDateOptions() {
  const { t } = useTranslation("capture");
  const [today, setToday] = useState(() => todayValue());

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const timer = setTimeout(() => setToday(todayValue()), midnight - now);
    return () => clearTimeout(timer);
  }, [today]);

  const weekdays = t("weekdays", { returnObjects: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- today only says when to rebuild
  const dates = useMemo(() => dateOptions().map((d) => ({ value: d.value, label: `${d.value} (${weekdays[d.day]})` })), [today, weekdays]);
  return { dates, today };
}

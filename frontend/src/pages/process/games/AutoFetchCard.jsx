import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import FormCard from "@/components/shared/form-modal/FormCard.jsx";
import { Field, PasswordInput, TextInput, ToggleSwitch } from "@/components/shared/form-modal/fields.jsx";

/**
 * Auto Fetch of the Add / Edit Process form: the report website this process reads its Data Capture Table from, so the
 * Upline / Downline tables do not have to be copied in by hand on the capture day (Data Capture does the fetch, and the
 * website's validation code is still typed by the person there).
 * value / onChange: the { enabled, siteUrl, username, password, pin, hasPassword, hasPin, existed } of the form.
 * The password and the PIN are kept encrypted on the server and never sent back, so on an edit the boxes start empty and
 * only replace what is saved when something is typed in them.
 */
export default function AutoFetchCard({ value, onChange }) {
  const { t } = useTranslation("process");
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  const on = Boolean(value.enabled);

  return (
    <FormCard
      title={t("form.autoFetch")}
      right={<ToggleSwitch on={on} onToggle={() => onChange({ ...value, enabled: !on })} label={on ? t("form.on") : t("form.off")} className="font-semibold" />}
      className="flex-none @max-[899px]/main:overflow-visible"
      bodyClassName="flex flex-col @max-[899px]/main:overflow-visible"
    >
      <div className={cn("flex min-h-0 flex-1 flex-col gap-2.5 modal-compact:gap-1.5", !on && "pointer-events-none opacity-55")}>
        <Field label={t("form.autoFetchSite")}>
          <TextInput value={value.siteUrl} onChange={set("siteUrl")} autoComplete="off" spellCheck={false} placeholder="https://www.example.com" />
          <Hint>{t("form.autoFetchSiteHint")}</Hint>
        </Field>
        <div className="grid grid-cols-3 gap-x-3 @max-[599px]/main:grid-cols-1 @max-[599px]/main:gap-y-2.5">
          <Field label={t("form.autoFetchUsername")}>
            <TextInput value={value.username} onChange={set("username")} autoComplete="off" spellCheck={false} placeholder={t("form.autoFetchUsernamePlaceholder")} />
          </Field>
          <Field label={t("form.autoFetchPassword")} optional={value.hasPassword}>
            <PasswordInput value={value.password} onChange={set("password")} placeholder={value.hasPassword ? t("form.autoFetchKept") : t("form.autoFetchPasswordPlaceholder")} />
          </Field>
          <Field label={t("form.autoFetchPin")} optional>
            <PasswordInput value={value.pin} onChange={set("pin")} placeholder={value.hasPin ? t("form.autoFetchKept") : t("form.autoFetchPinPlaceholder")} />
          </Field>
        </div>
        <Hint>{(value.hasPassword || value.hasPin) ? t("form.autoFetchSavedHint") : t("form.autoFetchSecretHint")}</Hint>
      </div>
    </FormCard>
  );
}

function Hint({ children }) {
  return <span className="mt-1 ml-0.5 block fm-help italic leading-snug text-[#8a96a8] modal-tiny:mt-0.5">{children}</span>;
}

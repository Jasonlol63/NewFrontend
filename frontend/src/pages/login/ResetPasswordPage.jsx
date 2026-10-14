import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Check, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { postForm } from "@/lib/api";
import { cn } from "@/lib/utils";
import PillField from "./components/PillField.jsx";
import PillSwitch from "@/components/shared/PillSwitch.jsx";
import StepDots from "./components/StepDots.jsx";
import PasswordStrengthMeter from "./components/PasswordStrengthMeter.jsx";

// Same as the backend's resend cooldown.
const RESEND_SECONDS = 60;
const MIN_PASSWORD_LENGTH = 6;
const INVALID_CODE = "Verification code is invalid or expired";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
];

// The account is named by its login ID or, for someone who forgot it, by its name; the email must match either way.
const LOOKUPS = {
  loginId: { label: "ID", placeholder: "Login ID", param: "login_id" },
  name: { label: "Name", placeholder: "Your name", param: "name" },
};

function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - 2, 3))}@${domain}`;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [role, setRole] = useState("admin");
  const [companyId, setCompanyId] = useState("");
  const [lookup, setLookup] = useState("loginId");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (step !== 2 || secondsLeft <= 0) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [step, secondsLeft]);

  const accountParams = () => ({
    role,
    tenant_code: companyId.trim(),
    [LOOKUPS[lookup].param]: identifier.trim(),
    email: email.trim(),
  });

  // The backend answers the same whether or not the account exists, so reaching step 2 only means "if it exists, a code was sent".
  const sendCode = async (nextStep) => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await postForm("/auth/send-reset-tac", accountParams());
      setSecondsLeft(RESEND_SECONDS);
      if (nextStep) {
        setOtp("");
        setOtpError(false);
        setStep(nextStep);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSendCode = (e) => {
    e.preventDefault();
    sendCode(2);
  };

  const onResendCode = () => sendCode(null);

  // The code is only checked by the backend together with the new password (it is one-time use).
  const onVerifyCode = (e) => {
    e.preventDefault();
    if (otp.length < 6) {
      setOtpError(true);
      return;
    }
    setOtpError(false);
    setError("");
    setStep(3);
  };

  const onResetPassword = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await postForm("/auth/reset-password", { ...accountParams(), tac: otp, new_password: newPassword });
      setStep(4);
    } catch (err) {
      if (err.message === INVALID_CODE) {
        setOtp("");
        setOtpError(true);
        setStep(2);
      }
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onBack = () => {
    if (step === 1 || step === 4) {
      navigate("/login");
      return;
    }
    setError("");
    setStep((s) => s - 1);
  };

  const errorMessage = error && (
    <p role="alert" className="m-0 text-center text-xs font-medium text-red-500">
      {error}
    </p>
  );

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 bg-[#dbe9fb] bg-[url('/images/count_bg.webp')] bg-cover bg-center bg-no-repeat">
      <div className="w-full max-w-[400px] py-fluid-md">
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-white to-[#f5f9ff] px-8 pb-8 pt-[26px] shadow-[0_30px_60px_-20px_rgba(20,70,160,0.35),0_10px_25px_-10px_rgba(20,70,160,0.25),inset_0_1px_0_rgba(255,255,255,0.6)]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="absolute left-6 top-[26px] z-10 flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[#2f6fef] transition-colors hover:bg-[#2f6fef]/10"
          >
            <ArrowLeft size={20} />
          </button>

          {step <= 3 && <StepDots step={step} total={3} />}

          {step === 1 && (
            <div key="step-1" className="animate-[fadeSlide_0.32s_ease]">
              <h1 className="mb-6 text-center text-[20px] font-semibold tracking-[-0.2px] text-[#14336b]">
                Reset Password
              </h1>

              <form onSubmit={onSendCode} className="flex flex-col gap-3.5">
                <div className="flex justify-center">
                  <PillSwitch options={ROLE_OPTIONS} value={role} onChange={setRole} itemWidth={104} />
                </div>
                <PillField
                  icon={Building2}
                  placeholder="Company / Group ID"
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value.toUpperCase())}
                />
                <PillField
                  icon={User}
                  placeholder={LOOKUPS[lookup].placeholder}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(lookup === "loginId" ? e.target.value.toUpperCase() : e.target.value)}
                  className="pr-[112px]"
                  trailing={
                    <div
                      role="group"
                      aria-label="Find my account by"
                      className="absolute right-[7px] top-1/2 flex -translate-y-1/2 rounded-full bg-[#e3edfb] p-[3px]"
                    >
                      {Object.entries(LOOKUPS).map(([key, opt]) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={lookup === key}
                          onClick={() => {
                            if (lookup === key) return;
                            setLookup(key);
                            setIdentifier("");
                          }}
                          className={cn(
                            "cursor-pointer rounded-full border-none px-2.5 py-[3px] text-[11px] font-semibold transition-colors",
                            lookup === key ? "bg-white text-[#2f6fef] shadow-[0_1px_3px_rgba(20,70,160,0.25)]" : "bg-transparent text-[#7c93b8]"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  }
                />
                <PillField
                  icon={Mail}
                  type="email"
                  placeholder="Enter your email address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                {errorMessage}

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full cursor-pointer rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-sm font-semibold text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Send Verification Code
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div key="step-2" className="animate-[fadeSlide_0.32s_ease]">
              <h1 className="text-center text-[20px] font-semibold tracking-[-0.2px] text-[#14336b]">
                Verify Code
              </h1>
              <p className="mb-6 mt-2 text-center text-[12.5px] leading-relaxed text-[#7c93b8]">
                We sent a 6-digit code to
                <br />
                <b className="font-semibold text-[#35538c]">{maskEmail(email || "you@example.com")}</b>
              </p>

              <form onSubmit={onVerifyCode} className="flex flex-col gap-3.5">
                <PillField
                  center
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="- - - - - -"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setOtpError(false);
                  }}
                  className={otpError ? "border-red-400 focus:border-red-400 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]" : undefined}
                />

                <div className="-mt-1.5 mb-1 text-center text-xs text-[#8fa8cf]">
                  Didn&apos;t receive it?{" "}
                  <button
                    type="button"
                    onClick={onResendCode}
                    disabled={secondsLeft > 0 || submitting}
                    className="cursor-pointer border-none bg-transparent p-0 font-semibold text-[#2f6fef] disabled:cursor-default disabled:text-[#a9c3e6]"
                  >
                    {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
                  </button>
                </div>

                {errorMessage}

                <button
                  type="submit"
                  className="h-11 w-full cursor-pointer rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-sm font-semibold text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] transition-transform active:scale-[0.99]"
                >
                  Continue
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setStep(1);
                  }}
                  className="mt-1 block w-full cursor-pointer border-none bg-transparent text-center text-xs font-semibold text-[#2f6fef]"
                >
                  ← Use a different email
                </button>
              </form>
            </div>
          )}

          {step === 3 && (
            <div key="step-3" className="animate-[fadeSlide_0.32s_ease]">
              <h1 className="text-center text-[20px] font-semibold tracking-[-0.2px] text-[#14336b]">
                Set New Password
              </h1>
              <p className="mb-6 mt-2 text-center text-[12.5px] leading-relaxed text-[#7c93b8]">
                Create a new password. Your secondary password stays as it is.
              </p>

              <form onSubmit={onResetPassword} className="flex flex-col gap-3.5">
                <PillField
                  icon={Lock}
                  type={showNewPassword ? "text" : "password"}
                  placeholder="New Password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                      className="absolute right-[18px] top-1/2 flex h-4 w-4 -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#4f8ef0]"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                <PasswordStrengthMeter password={newPassword} />

                <PillField
                  icon={Lock}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm New Password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute right-[18px] top-1/2 flex h-4 w-4 -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#4f8ef0]"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                {errorMessage}

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full cursor-pointer rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-sm font-semibold text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Reset Password
                </button>
              </form>
            </div>
          )}

          {step === 4 && (
            <div key="step-4" className="animate-[fadeSlide_0.32s_ease] pb-1 pt-1.5 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55)]">
                <Check size={26} strokeWidth={3} />
              </div>
              <h2 className="mb-2 text-[18px] font-semibold text-[#14336b]">Password Reset</h2>
              <p className="mb-[22px] text-[12.5px] leading-relaxed text-[#7c93b8]">
                Your password has been updated successfully.
                <br />
                You can now log in with your new password.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="h-11 w-full cursor-pointer rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-sm font-semibold text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] transition-transform active:scale-[0.99]"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

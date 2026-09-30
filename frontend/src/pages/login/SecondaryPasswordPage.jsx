import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import StatusDialog from "@/components/shared/StatusDialog.jsx";
import { postForm } from "@/lib/api";

// Owner and admin ("user") have separate verify endpoints.
const VERIFY_URLS = {
  owner: "/auth/verify-owner-secondary-password",
  user: "/auth/verify-user-secondary-password",
};

// Backend verify error messages -> dialog title. Anything unlisted is shown
// as the backend sent it.
const ERROR_TITLES = {
  "Secondary password is incorrect": "Username/Password Incorrect",
};

const CONFIRM_TEXT = { en: "Try again", zh: "重新输入" };

export default function SecondaryPasswordPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");

  // Only reachable right after a successful login that needs this step.
  const verifyUrl = VERIFY_URLS[state?.userType];
  if (!verifyUrl) {
    return <Navigate to="/login" replace />;
  }

  const onChangePassword = (e) => {
    setPassword(e.target.value.replace(/\D/g, "").slice(0, 6));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting || password.length !== 6) return;
    setSubmitting(true);
    try {
      await postForm(verifyUrl, { secondary_password: password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setErrorTitle(ERROR_TITLES[err.message] ?? err.message);
      setErrorOpen(true);
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 bg-[#dbe9fb] bg-[url('/images/count_bg.png')] bg-cover bg-center bg-no-repeat">
      <div className="w-full max-w-[400px] py-fluid-md">
        <div className="relative rounded-[24px] bg-gradient-to-b from-white to-[#f5f9ff] px-8 pb-8 pt-[34px] shadow-[0_30px_60px_-20px_rgba(20,70,160,0.35),0_10px_25px_-10px_rgba(20,70,160,0.25),inset_0_1px_0_rgba(255,255,255,0.6)]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="absolute left-6 top-[26px] flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[#2f6fef] transition-colors hover:bg-[#2f6fef]/10"
          >
            <ArrowLeft size={20} />
          </button>

          <h1 className="mt-1 text-center text-[20px] font-bold leading-[1.3] tracking-[-0.2px] text-[#14336b]">
            Secondary Password
            <br />
            Verification
          </h1>
          <p className="mb-[26px] mt-2.5 text-center text-[12.5px] leading-relaxed text-[#7c93b8]">
            Please enter your 6-digit secondary password to continue
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <div className="relative">
              <span className="pointer-events-none absolute left-[18px] top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[#4f8ef0]">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit password"
                value={password}
                onChange={onChangePassword}
                className="h-12 w-full rounded-full border-[1.5px] border-[#bcd9fb] bg-gradient-to-b from-white to-[#f7fbff] px-[46px] text-[13px] tracking-[1px] text-[#35538c] shadow-[inset_0_1px_2px_rgba(20,70,160,0.05)] outline-none transition-[border-color,box-shadow] placeholder:tracking-normal placeholder:text-[#a9c3e6] focus:border-[#4f8ef0] focus:shadow-[0_0_0_4px_rgba(79,142,240,0.12)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-[18px] top-1/2 flex h-4 w-4 -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#4f8ef0]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting || password.length !== 6}
              className="h-11 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 rounded-full border-none bg-[linear-gradient(100deg,#0a3fc9_0%,#2f8dff_55%,#3fc4ff_100%)] text-sm font-bold text-white shadow-[0_14px_24px_-8px_rgba(20,90,220,0.55),inset_0_-3px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,0.35)] transition-transform active:scale-[0.99]"
            >
              Verify
            </button>
          </form>
        </div>
      </div>

      <StatusDialog
        open={errorOpen}
        onOpenChange={setErrorOpen}
        type="error"
        title={errorTitle}
        confirmText={CONFIRM_TEXT[state.lang] ?? CONFIRM_TEXT.en}
      />
    </div>
  );
}

function scorePassword(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function levelFromScore(score) {
  if (score <= 2) return { label: "Weak", fillCount: 1, color: "#e0533d" };
  if (score <= 3) return { label: "Medium", fillCount: 2, color: "#d99a1f" };
  return { label: "Strong", fillCount: 3, color: "#2fae6b" };
}

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const level = levelFromScore(scorePassword(password));

  return (
    <div className="px-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-[#dde6f5]">
            <div
              className="h-full origin-left rounded-full transition-transform duration-[250ms] ease-out"
              style={{
                transform: i < level.fillCount ? "scaleX(1)" : "scaleX(0)",
                backgroundColor: level.color,
              }}
            />
          </div>
        ))}
      </div>
      <span className="mt-1.5 block text-[11px] font-bold" style={{ color: level.color }}>
        {level.label}
      </span>
    </div>
  );
}

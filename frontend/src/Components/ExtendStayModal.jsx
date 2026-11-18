import React, { useEffect, useRef, useState } from "react";

/*
 * EXTEND STAY — add nights to an active stay.
 *
 * The browser never works out a price: every figure shown here comes from the
 * server's own preview (GET /extend-stay), which uses the same arithmetic the
 * bill does, and the same request is what gets saved (POST /extend-stay).
 *
 *   mode "planned"  — the guest asks to stay longer; staff pick a new date
 *   mode "overstay" — the guest stayed past the due-out time; the extra
 *                     nights (each FULL 24 hours = 1 night) are pre-filled
 */

const money = (n) =>
  `Rs.${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

/*
 * YYYY-MM-DD of a booking date, read in India time — the same rule the server
 * uses (istDateKey). MySQL DATEs arrive as midnight in the server's own
 * timezone, so "2026-11-12" can come through as "2026-11-11T18:30:00.000Z";
 * slicing that would show the day before.
 */
function istKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function addDays(key, days) {
  const [y, m, d] = String(key).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

const fmtDate = (key) => {
  if (!key) return "—";
  const [y, m, d] = String(key).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const fmtDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    : "—";

export default function ExtendStayModal({
  bookingId,
  currentCheckOut,
  mode = "planned",
  overstay = null,
  apiFetch,
  toast,
  onClose,
  onDone,
}) {
  const currentKey = istKey(currentCheckOut);
  const minKey = currentKey ? addDays(currentKey, 1) : "";

  const [newDate, setNewDate] = useState(
    mode === "overstay"
      ? overstay?.plan?.new_check_out_date ||
          overstay?.suggested_check_out_date ||
          ""
      : minKey,
  );
  const [plan, setPlan] = useState(
    mode === "overstay" ? overstay?.plan || null : null,
  );
  const [error, setError] = useState(
    mode === "overstay" ? overstay?.plan_error || "" : "",
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // the parent may hand over a new apiFetch on every render; the preview
  // should only re-run when the DATE changes
  const fetchRef = useRef(apiFetch);
  fetchRef.current = apiFetch;

  // planned extension: ask the server for the exact new bill
  useEffect(() => {
    if (mode !== "planned" || !newDate) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await fetchRef.current(
          `/api/bookings/${bookingId}/extend-stay?new_check_out_date=${encodeURIComponent(
            newDate,
          )}`,
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setPlan(null);
          setError(data.error || "Could not check this date");
        } else {
          setPlan(data);
        }
      } catch (err) {
        if (!cancelled) {
          setPlan(null);
          setError(err.message || "Could not check this date");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, newDate, bookingId]);

  async function confirm() {
    if (!plan || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/bookings/${bookingId}/extend-stay`, {
        method: "POST",
        body: JSON.stringify({
          new_check_out_date: plan.new_check_out_date,
          reason: mode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not extend the stay");
      toast &&
        toast(
          `Stay extended to ${fmtDate(data.new_check_out_date)} — balance due ${money(
            data.remaining_amount ?? data.new_balance,
          )}`,
          "success",
        );
      onDone && onDone(data);
    } catch (err) {
      setError(err.message);
      toast && toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const nights = plan?.added_nights || 0;

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/45 p-4"
      onClick={() => !saving && onClose && onClose()}
    >
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="bg-navy px-5 py-4">
          <div className="font-serif text-[1.05rem] font-semibold text-white">
            {mode === "overstay" ? "Late check-out" : "Extend stay"}
          </div>
          <div className="mt-0.5 text-[0.72rem] text-white/55">
            Booking #{bookingId} · current check-out {fmtDate(currentKey)}
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {mode === "overstay" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[0.78rem] leading-relaxed text-amber-900">
              Due out at <b>{fmtDateTime(overstay?.due_out)}</b>. The guest has
              stayed <b>{overstay?.over_hours} hr</b> past that.
              <div className="mt-1 text-[0.72rem] text-amber-800/80">
                Each full 24 hours past the due-out time is one more night.
                Less than 24 hours is not charged automatically.
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[0.65rem] font-bold uppercase tracking-[1px] text-[#868E96]">
                New check-out date
              </label>
              <input
                type="date"
                value={newDate}
                min={minKey}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded-md border border-[#E9ECEF] px-3 py-2.5 text-sm outline-none focus:border-[#C9A84C]"
              />
            </div>
          )}

          {loading && (
            <div className="text-center text-[0.78rem] text-gray-400">
              Checking room and price…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[0.78rem] text-red-700">
              {error}
            </div>
          )}

          {!loading && plan && (
            <div className="rounded-lg border border-gray-200">
              {[
                [
                  "Check-out",
                  `${fmtDate(plan.current_check_out_date)} → ${fmtDate(
                    plan.new_check_out_date,
                  )}`,
                ],
                [
                  "Extra nights",
                  `${nights} × ${money(plan.nightly_rate)} (booked rate)`,
                ],
                ["Extra amount (incl. GST)", money(plan.extra_amount)],
                ["New bill total", money(plan.new_total)],
                ["Already paid", money(plan.paid)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-3 border-b border-gray-100 px-3 py-2 text-[0.8rem]"
                >
                  <span className="text-gray-500">{label}</span>
                  <span className="text-right font-medium text-navy">
                    {value}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 bg-[#FBF6E8] px-3 py-2.5">
                <span className="text-[0.8rem] font-semibold text-navy">
                  Balance to collect
                </span>
                <span className="text-[1rem] font-bold text-navy">
                  {money(plan.new_balance)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex gap-2.5 border-t border-gray-100 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5 text-[0.82rem] font-semibold text-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!plan || loading || saving}
            className="flex-[1.4] rounded-lg bg-navy py-2.5 text-[0.82rem] font-bold text-gold disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            {saving
              ? "Saving…"
              : nights
                ? `Add ${nights} night${nights === 1 ? "" : "s"} to the bill`
                : "Add to the bill"}
          </button>
        </div>
      </div>
    </div>
  );
}

/*
 * BOOKING SOURCE — where the guest booked from.
 *
 * Stored on the booking as booking_channel (a label only — no amount,
 * payment or status depends on it). Website and bulk bookings are filled in
 * by the server; the desk picks one of these on New Booking.
 *
 * To add or rename an option, change this list — nothing else needs to know.
 */
export const BOOKING_CHANNELS = [
  "Walk-in",
  "Phone call",
  "WhatsApp",
  "Agoda",
  "MakeMyTrip",
  "Goibibo",
  "Booking.com",
  "Travel Agent",
];

export const OTHER_CHANNEL = "Other";

// matches the server's limit (BOOKING_CHANNEL_MAX)
export const CHANNEL_MAX = 40;

export const NOT_RECORDED = "Not recorded";

// what to show for a booking — older bookings may have none
export function channelOf(booking) {
  const c = booking?.booking_channel;
  return c && String(c).trim() ? String(c).trim() : NOT_RECORDED;
}

const ONLINE_TRAVEL_AGENTS = new Set(["Agoda", "MakeMyTrip", "Goibibo", "Booking.com"]);

/*
 * Report breakdown: bookings and revenue per source.
 *
 * Revenue is advance_paid + balance_paid — exactly how the server computes
 * the report's "Total Revenue" over the same rows — so the per-source figures
 * always add up to that card. "Not recorded" is listed last.
 */
export function summariseBySource(bookings = []) {
  const bySource = new Map();
  for (const b of bookings) {
    const label = channelOf(b);
    const row = bySource.get(label) || { label, count: 0, revenue: 0 };
    row.count += 1;
    row.revenue =
      Math.round(
        (row.revenue + Number(b.advance_paid || 0) + Number(b.balance_paid || 0)) * 100,
      ) / 100;
    bySource.set(label, row);
  }
  return [...bySource.values()].sort((a, b) => {
    if (a.label === NOT_RECORDED) return 1;
    if (b.label === NOT_RECORDED) return -1;
    return b.revenue - a.revenue || b.count - a.count || a.label.localeCompare(b.label);
  });
}

// small badge colours: travel sites, our website, desk/other, not recorded
export function channelBadgeClass(label) {
  if (label === NOT_RECORDED) return "bg-[#F8F9FA] text-[#ADB5BD] border-[#E9ECEF]";
  if (ONLINE_TRAVEL_AGENTS.has(label)) return "bg-[#EBF2FF] text-[#2F5BB7] border-[#C9DAFB]";
  if (label === "Website") return "bg-[#FBF6E8] text-[#9A7A2A] border-[#EADFB8]";
  return "bg-[#F1F3F5] text-[#495057] border-[#DEE2E6]";
}

/*
 * Actual check-in / check-out time for the reports.
 *
 * The report columns used to show only the BOOKED date. The desk records the
 * real moment a guest arrives and leaves (actual_checkin / actual_checkout),
 * and that is what the manager wants to see next to the date.
 *
 * Always shown in India time, whatever the timezone of the computer the
 * report is opened or the PDF is downloaded on.
 *
 *   formatStayTime("2026-10-31T04:38:00Z", "2026-10-31")  ->  "10:08 am"
 *   formatStayTime("2026-10-31T05:51:00Z", "2026-10-30")  ->  "31 Oct, 11:21 am"
 *     (left a day later than booked, so the day is printed too)
 *   formatStayTime(null, "2026-10-31")                    ->  ""
 *
 * The day is added only when the guest actually arrived or left on a
 * different day from the booked one, so the usual case stays short.
 */

const IST = "Asia/Kolkata";

// Some browsers put a narrow no-break space (U+202F) or a no-break space
// (U+00A0) before "am"/"pm". jsPDF's built-in fonts cannot draw either and
// print a garbage glyph, so turn them into ordinary spaces.
const plainSpaces = (s) => String(s).replace(/[  ]/g, " ");

// YYYY-MM-DD in India time — the same shape as the booked date column
function istDayKey(d) {
  return d.toLocaleDateString("en-CA", { timeZone: IST });
}

export function formatStayTime(actual, bookedDate) {
  if (!actual) return "";

  const d = new Date(actual);
  if (Number.isNaN(d.getTime())) return "";

  const time = plainSpaces(
    d.toLocaleTimeString("en-IN", {
      timeZone: IST,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  ).toLowerCase();

  const booked = bookedDate ? String(bookedDate).slice(0, 10) : "";

  if (booked && istDayKey(d) !== booked) {
    const day = plainSpaces(
      d.toLocaleDateString("en-IN", {
        timeZone: IST,
        day: "2-digit",
        month: "short",
      }),
    );
    return `${day}, ${time}`;
  }

  return time;
}

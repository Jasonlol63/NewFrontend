// The one Decimal of the app: 40 digits, cut down by default (money is cut, never rounded up unless a call says so).
// A clone, so the settings never leak into other users of decimal.js.
import DecimalJs from "decimal.js";

const Decimal = DecimalJs.clone({ precision: 40, rounding: DecimalJs.ROUND_DOWN });

export default Decimal;
export { Decimal };

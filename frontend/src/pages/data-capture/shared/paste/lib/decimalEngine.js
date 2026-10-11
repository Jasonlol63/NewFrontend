// One configured Decimal for the paste modules: 40 digits, rounding down (money is cut, never rounded up).
import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_DOWN });

export default Decimal;
export { Decimal };

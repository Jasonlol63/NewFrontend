import { useListScope } from "@/components/shared/list/useListScope";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isBankCompany } from "@/pages/process/companyCategory";
import BankCaptureView from "./bank/BankCaptureView.jsx";
import GameCaptureView from "./games/GameCaptureView.jsx";

/**
 * Data Capture (/data-capture): owns the Group / Company scope and shows the capture view of the picked company's
 * kind: Bank companies capture a fixed process list (bank/), Game companies pick a process with its descriptions (games/).
 * Submit in either view opens the Data Capture Summary (summary/).
 */
export default function DataCapturePage() {
  const readOnly = Boolean(useCurrentUser()?.readOnly);
  const scope = useListScope("dataCapture.scope");
  const isBank = scope.company !== null && isBankCompany(scope.company);
  return isBank ? <BankCaptureView scope={scope} readOnly={readOnly} /> : <GameCaptureView scope={scope} readOnly={readOnly} />;
}

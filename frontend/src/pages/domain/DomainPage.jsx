import { useCallback, useState } from "react";
import { CircleDollarSign, Plus, Search, Trash2 } from "lucide-react";
import DataTable from "@/components/shared/list/DataTable.jsx";
import { PrimaryButton, SecondaryButton } from "@/components/shared/list/ListToolbar.jsx";
import { IconAction } from "@/components/shared/list/cells.jsx";
import { useListView } from "@/components/shared/list/useListView";
import CodeChips from "./CodeChips.jsx";
import DomainFormModal from "./DomainFormModal.jsx";
import { MAX_COMPANIES, MAX_GROUPS, MOCK_DOMAINS, canDeleteDomain, filterDomains, sortDomains } from "./domainRules";

const NOT_BUILT = "Not available yet";
// Gap between the row cards; useListView needs the same number to work out how many rows fit.
const ROW_GAP = 8;

const buttonSize = "h-9 py-0";

/**
 * Domain: owners with their groups and companies.
 * Design preview only: the rows are placeholders and nothing here calls the API yet (Price and Delete are
 * not wired; Add and Edit open the form modal, whose Save just closes it). Rows are cards without a frame
 * around the list or the toolbar.
 */
export default function DomainPage() {
  // null = closed, { mode: "add" } or { mode: "edit", domain } = open
  const [domainForm, setDomainForm] = useState(null);
  const closeDomainForm = useCallback(() => setDomainForm(null), []);
  const view = useListView(MOCK_DOMAINS, { filter: filterDomains, sort: sortDomains, canSelect: canDeleteDomain, rowGap: ROW_GAP });

  const columns = [
    { key: "no", label: "No", sortable: false, className: "w-[48px]", cellClassName: "text-dash-sub tabular-nums", render: (_, n) => n },
    { key: "ownerCode", label: "Owner Code", cellClassName: "font-semibold whitespace-nowrap", render: (r) => r.ownerCode },
    { key: "name", label: "Name", fit: true, cellClassName: "whitespace-nowrap", render: (r) => r.name },
    { key: "email", label: "Email", fit: true, cellClassName: "text-[#374151]", render: (r) => r.email },
    {
      key: "groups",
      label: "Groups",
      sortable: false,
      render: (r) => <CodeChips codes={r.groups} max={MAX_GROUPS} tone="group" />,
    },
    {
      key: "companies",
      label: "Companies",
      sortable: false,
      render: (r) => <CodeChips codes={r.companies} max={MAX_COMPANIES} tone="company" />,
    },
    { key: "createdBy", label: "Created By", cellClassName: "whitespace-nowrap", render: (r) => r.createdBy || "-" },
    {
      key: "action",
      label: "Action",
      sortable: false,
      className: "text-center",
      render: (r) => <IconAction title="Edit domain" aria-label="Edit domain" onClick={() => setDomainForm({ mode: "edit", domain: r })} />,
    },
  ];

  const selected = view.selectedRows.length;

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]">
      <div className="flex flex-none flex-wrap items-center gap-2.5 px-1">
        <PrimaryButton icon={Plus} className={buttonSize} onClick={() => setDomainForm({ mode: "add" })}>
          Add Domain
        </PrimaryButton>

        <label className="flex h-9 w-full max-w-[280px] min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-dash-line bg-white px-3 text-[13px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] focus-within:border-[#3b82f6]">
          <Search className="size-4 flex-none text-dash-faint" strokeWidth={2.2} />
          <input
            value={view.search}
            onChange={(e) => view.setSearch(e.target.value)}
            className="w-full bg-transparent uppercase outline-none placeholder:normal-case placeholder:text-dash-faint"
            placeholder="Search by Owner Name/Company"
          />
        </label>

        <SecondaryButton icon={CircleDollarSign} className={buttonSize} title={NOT_BUILT}>
          Price
        </SecondaryButton>

        {/* Always red, like the old page; it only acts once the API is wired. */}
        <button
          type="button"
          title={NOT_BUILT}
          className="ml-auto inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-[10px] bg-[linear-gradient(180deg,#ff6b6b_0%,#dc2626_100%)] px-4 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(220,38,38,0.6)] transition-[filter] hover:brightness-105"
        >
          <Trash2 className="size-4" strokeWidth={2.2} />
          Delete ({selected})
        </button>
      </div>

      <DataTable variant="cards" columns={columns} noun="domains" minWidth="min-w-0" fitWidth emptyMessage="No domains found" {...view.table} />

      {/* Add Domain and Edit Domain share one modal. UI only for now: Save just closes it. */}
      {domainForm && (
        <DomainFormModal mode={domainForm.mode} domain={domainForm.domain} onClose={closeDomainForm} onSave={closeDomainForm} />
      )}
    </div>
  );
}

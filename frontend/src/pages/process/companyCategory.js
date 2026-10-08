// TEMPORARY while the Bank Process page is a UI draft: the backend does not tell the frontend a company's
// category yet. Once /auth/tenant-accessible returns `has_bank` / `has_game` per company, replace this with that flag
// (useListScope would pass the company's category along) and delete the list below.
const MOCK_BANK_COMPANIES = new Set(["CX"]);

export const isBankCompany = (companyCode) => MOCK_BANK_COMPANIES.has(companyCode);

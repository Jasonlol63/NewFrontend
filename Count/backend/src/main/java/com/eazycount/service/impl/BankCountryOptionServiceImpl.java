package com.eazycount.service.impl;

import com.eazycount.audit.AuditContext;
import com.eazycount.audit.AuditSnapshots;
import com.eazycount.audit.Audited;
import com.eazycount.common.BusinessException;
import com.eazycount.dao.BankCountryOptionDao;
import com.eazycount.dao.CurrencyDao;
import com.eazycount.entity.AuditLog;
import com.eazycount.entity.BankCountry;
import com.eazycount.entity.BankOption;
import com.eazycount.entity.Currency;
import com.eazycount.service.BankCountryOptionService;
import com.eazycount.util.AccessControlUtils;
import com.eazycount.util.AssertUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class BankCountryOptionServiceImpl implements BankCountryOptionService {

    @Autowired
    private BankCountryOptionDao bankCountryOptionDao;

    @Autowired
    private CurrencyDao currencyDao;

    @Override
    public List<BankCountry> findAllCountry(Integer tenantId) {
        AccessControlUtils.requireLoggedIn();

        AccessControlUtils.requireValidTenantId(tenantId);

        return bankCountryOptionDao.findAllCountry(tenantId);
    }

    @Override
    public List<BankOption> findAllBankInCountry(Integer tenantId, Integer countryId) {
        AccessControlUtils.requireLoggedIn();

        AccessControlUtils.requireValidTenantId(tenantId);
        if (countryId == null) {
            throw new BusinessException("Country ID is required!");
        }

        AssertUtils.requireFound(bankCountryOptionDao.findCountryById(tenantId, countryId), "Country not found!");

        return bankCountryOptionDao.findAllBankInCountry(tenantId, countryId);
    }

    @Transactional
    @Override
    @Audited(module = "BANK_COUNTRY", action = AuditLog.Action.CREATE, entityIdExpr = "#bankCountry.id", sourceTable = "bank_country")
    public void insertNewCountry(BankCountry bankCountry) {
        AccessControlUtils.requireWritable(AccessControlUtils.requireLoggedIn());
        AccessControlUtils.requireValidTenantId(bankCountry != null ? bankCountry.getTenantId() : null);

        String code = bankCountry.getCode() != null ? bankCountry.getCode().trim().toUpperCase() : "";
        if (code.isBlank()) {
            throw new BusinessException("Country code is required!");
        }

        BankCountry match = bankCountryOptionDao.findCountryByCode(bankCountry.getTenantId(), code);
        if (match != null) {
            throw new BusinessException("Country Name already exists!");
        }

        bankCountry.setCode(code);

        try {
            bankCountryOptionDao.insertNewCountry(bankCountry);
        } catch (Exception e) {
            throw new BusinessException("Failed to insert new country!");
        }

        syncCurrencyFromBankCountry(bankCountry.getTenantId(), code);

        AuditContext.captureAfter(bankCountry.getId(),
                AuditSnapshots.bankCountry(bankCountryOptionDao.findCountryById(bankCountry.getTenantId(), bankCountry.getId())));
    }

    // Sync: Bank Country add -> Currency add (skip if a currency with this code already exists for the tenant)
    private void syncCurrencyFromBankCountry(Integer tenantId, String code) {
        Currency existing = currencyDao.findByTenantIdAndCode(tenantId, code);
        if (existing != null) {
            return;
        }

        Currency currency = new Currency();
        currency.setTenantId(String.valueOf(tenantId));
        currency.setCode(code);
        currency.setSyncSource(Currency.SourceType.MANUAL);
        currency.setStatus(Currency.Status.ACTIVE);

        try {
            currencyDao.addNewCurrency(currency);
        } catch (Exception e) {
            throw new BusinessException("Failed to sync currency from bank country!");
        }
    }

    @Transactional
    @Override
    @Audited(module = "BANK_OPTION", action = AuditLog.Action.CREATE, entityIdExpr = "#bankOption.id", sourceTable = "bank_option")
    public void insertNewBankOption(BankOption bankOption) {
        AccessControlUtils.requireWritable(AccessControlUtils.requireLoggedIn());

        AccessControlUtils.requireValidTenantId(bankOption != null ? bankOption.getTenantId() : null);
        if (bankOption.getCountryId() == null) {
            throw new BusinessException("Country ID is required!");
        }

        String name = bankOption.getName() != null ? bankOption.getName().trim().toUpperCase() : "";
        if (name.isBlank()) {
            throw new BusinessException("Bank Option name is required!");
        }

        AssertUtils.requireFound(
                bankCountryOptionDao.findCountryById(bankOption.getTenantId(), bankOption.getCountryId()), "Country not found!");

        BankOption match = bankCountryOptionDao.findBankOptionByName(
                bankOption.getTenantId(), bankOption.getCountryId(), name);
        if (match != null) {
            throw new BusinessException("Bank Option Name already exists!");
        }

        bankOption.setName(name);

        try {
            bankCountryOptionDao.insertNewBankOption(bankOption);
        } catch (Exception e) {
            throw new BusinessException("Failed to insert new bank option!");
        }

        AuditContext.captureAfter(bankOption.getId(), AuditSnapshots.bankOption(bankCountryOptionDao.findBankOptionById(
                bankOption.getTenantId(), bankOption.getCountryId(), bankOption.getId())));
    }

    @Transactional
    @Override
    @Audited(module = "BANK_COUNTRY", action = AuditLog.Action.DELETE, entityIdExpr = "#id", sourceTable = "bank_country")
    public void deleteCountryByIdAndTenantId(Integer id, Integer tenantId) {
        AccessControlUtils.requireWritable(AccessControlUtils.requireLoggedIn());

        if (id == null) {
            throw new BusinessException("Country ID is required!");
        }
        AccessControlUtils.requireValidTenantId(tenantId);

        BankCountry existing = AssertUtils.requireFound(bankCountryOptionDao.findCountryById(tenantId, id), "Country not found!");
        AuditContext.captureBefore(id, AuditSnapshots.bankCountry(existing));

        if (bankCountryOptionDao.countBankProcessByCountryId(tenantId, id) > 0) {
            throw new BusinessException("Cannot delete country. It is in use by one or more bank processes.");
        }

        try {
            bankCountryOptionDao.deleteCountryByIdAndTenantId(id, tenantId);
        } catch (Exception e) {
            throw new BusinessException("Failed to delete country! It may be in use by a bank process.");
        }
    }

    @Transactional
    @Override
    @Audited(module = "BANK_OPTION", action = AuditLog.Action.DELETE, entityIdExpr = "#id", sourceTable = "bank_option")
    public void deleteBankOptionByIdAndTenantId(Integer id, Integer tenantId, Integer countryId) {
        AccessControlUtils.requireWritable(AccessControlUtils.requireLoggedIn());

        if (id == null) {
            throw new BusinessException("Bank Option ID is required!");
        }
        AccessControlUtils.requireValidTenantId(tenantId);
        if (countryId == null) {
            throw new BusinessException("Country ID is required!");
        }

        BankOption existing = AssertUtils.requireFound(
                bankCountryOptionDao.findBankOptionById(tenantId, countryId, id), "Bank option not found!");
        AuditContext.captureBefore(id, AuditSnapshots.bankOption(existing));

        try {
            bankCountryOptionDao.deleteBankOptionByIdAndTenantId(id, tenantId, countryId);
        } catch (Exception e) {
            throw new BusinessException("Failed to delete bank option! It may be in use by a bank process.");
        }
    }

    @Transactional
    @Override
    @Audited(module = "BANK_OPTION", action = AuditLog.Action.UPDATE, entityIdExpr = "#bankOptions[0].countryId", sourceTable = "bank_option")
    public void updateSelectedBanks(List<BankOption> bankOptions) {
        AccessControlUtils.requireWritable(AccessControlUtils.requireLoggedIn());

        if (bankOptions == null || bankOptions.isEmpty()) {
            throw new BusinessException("At least one bank option is required!");
        }

        Integer tenantId = bankOptions.get(0).getTenantId();
        Integer countryId = bankOptions.get(0).getCountryId();
        AccessControlUtils.requireValidTenantId(tenantId);

        if (countryId == null) {
            throw new BusinessException("Country ID is required!");
        }
        AssertUtils.requireFound(bankCountryOptionDao.findCountryById(tenantId, countryId), "Country not found!");

        List<Integer> ids = bankOptions.stream()
                .filter(bo -> Boolean.TRUE.equals(bo.getSelected()) && bo.getId() != null && bo.getId() > 0)
                .map(BankOption::getId)
                .distinct()
                .toList();

        if (!ids.isEmpty()) {
            int validCount = bankCountryOptionDao.countValidBankOptionsForCountry(tenantId, countryId, ids);
            if (validCount != ids.size()) {
                throw new BusinessException("Invalid bank option for this country");
            }
            bankCountryOptionDao.markBanksSelected(tenantId, countryId, ids);
        }

        bankCountryOptionDao.unmarkSelectedBanksExcept(tenantId, countryId, ids);

        AuditContext.captureAfter(countryId, Map.of("selected_bank_option_ids", ids));
    }

}

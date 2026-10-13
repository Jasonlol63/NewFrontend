package com.eazycount.controller;

import com.eazycount.dto.*;
import com.eazycount.service.MaintenanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceController {

    @Autowired
    private MaintenanceService maintenanceService;

    @PostMapping("/transaction-maintenance/list")
    public ResponseEntity<Map<String, Object>> listTransactionMaintenance(@RequestBody MaintenanceTransactionDTO mt) {
        CursorPage<MaintenanceTransactionDTO> page = maintenanceService.findMaintenanceTransactionsRows(mt);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Transaction maintenance list retrieved");
        body.put("data", page.rows());
        body.put("nextCursor", page.nextCursor());
        body.put("total", page.total());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/capture-maintenance/list")
    public ResponseEntity<Map<String, Object>> listCaptureMaintenance(@RequestBody MaintenanceCaptureDTO mc) {
        CursorPage<MaintenanceCaptureDTO> page = maintenanceService.findMaintenanceCaptureRows(mc);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Capture maintenance list retrieved");
        body.put("data", page.rows());
        body.put("nextCursor", page.nextCursor());
        body.put("total", page.total());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/capture-maintenance/delete")
    public ResponseEntity<Map<String, Object>> deleteCaptureMaintenance(@RequestBody MaintenanceCaptureDTO mc) {
        maintenanceService.deleteMaintenanceCaptureRows(mc);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Capture deleted successfully");
        body.put("data", null);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/payment-maintenance/list")
    public ResponseEntity<Map<String, Object>> listPaymentMaintenance(@RequestBody MaintenancePaymentDTO request) {
        CursorPage<MaintenancePaymentDTO> page = maintenanceService.findPaymentMaintenanceRows(request);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Payment maintenance list retrieved");
        body.put("data", page.rows());
        body.put("nextCursor", page.nextCursor());
        body.put("total", page.total());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/payment-maintenance/delete")
    public ResponseEntity<Map<String, Object>> deletePaymentMaintenance(@RequestBody MaintenancePaymentDTO request) {
        maintenanceService.deletePaymentMaintenanceRows(request);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Payment deleted successfully");
        body.put("data", null);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/bankprocess-maintenance/list")
    public ResponseEntity<Map<String, Object>> listBankProcessMaintenance(@RequestBody MaintenanceBankProcessDTO request) {
        CursorPage<MaintenanceBankProcessDTO> page = maintenanceService.findBankProcessMaintenanceRows(request);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Bank process maintenance list retrieved");
        body.put("data", page.rows());
        body.put("nextCursor", page.nextCursor());
        body.put("total", page.total());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/bankprocess-maintenance/delete")
    public ResponseEntity<Map<String, Object>> deleteBankProcessMaintenance(@RequestBody MaintenanceBankProcessDTO request) {
        maintenanceService.deleteBankProcessMaintenanceRows(request);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "BankProcess deleted successfully");
        body.put("data", null);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/formula-maintenance/list")
    public ResponseEntity<Map<String, Object>> listFormulaMaintenance(@RequestBody MaintenanceFormulaDTO ft) {
        CursorPage<MaintenanceFormulaDTO> page = maintenanceService.findMaintenanceFormulaRows(ft);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Formula maintenance list retrieved");
        body.put("data", page.rows());
        body.put("nextCursor", page.nextCursor());
        body.put("total", page.total());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/formula-maintenance/update")
    public ResponseEntity<Map<String, Object>> updateFormulaMaintenance(@RequestBody MaintenanceFormulaDTO ft) {
        maintenanceService.updateFormulaMaintenance(ft);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Formula maintenance updated successfully");
        body.put("data", null);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/formula-maintenance/delete")
    public ResponseEntity<Map<String, Object>> deleteFormulaMaintenance(@RequestBody MaintenanceFormulaDTO ft) {
        maintenanceService.deleteFormulaMaintenance(ft);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Formula deleted successfully");
        body.put("data", null);
        return ResponseEntity.ok(body);
    }
}

package com.eazycount.controller;

import com.eazycount.dto.AutoFetchDTO;
import com.eazycount.dto.DataCaptureBankDTO;
import com.eazycount.dto.DataCaptureGameDTO;
import com.eazycount.service.AutoFetchService;
import com.eazycount.service.DataCaptureService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/datacapture")
public class DataCaptureController {

    @Autowired
    private DataCaptureService dataCaptureService;

    @Autowired
    private AutoFetchService autoFetchService;

    /**
     * Auto Fetch of the picked process: the Payment Report of its week, or the report website's validation-code image
     * when its session has to be opened first (the typed code comes back here with the ticket).
     */
    @PostMapping("/autofetch/report")
    public ResponseEntity<Map<String, Object>> autoFetchReport(@RequestBody AutoFetchDTO request) {
        AutoFetchDTO data = autoFetchService.fetch(request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "success",
                "data", data));
    }

    @PostMapping("/games/form")
    public ResponseEntity<Map<String, Object>> loadGameCaptureForm(@RequestBody DataCaptureGameDTO request) {
        DataCaptureGameDTO data = dataCaptureService.loadGameCaptureForm(request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "success",
                "data", data));
    }

    @PostMapping("/games/submitted")
    public ResponseEntity<Map<String, Object>> findAllProcessSubmittedByIdAndDate(@RequestBody DataCaptureGameDTO request) {
        List<DataCaptureGameDTO> data = dataCaptureService.findAllProcessSubmittedByIdAndDate(request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "success",
                "data", data));
    }

    @PostMapping("/bank/draft/save")
    public ResponseEntity<Map<String, Object>> saveBankDraft(@RequestBody DataCaptureBankDTO request) {
        DataCaptureBankDTO data = dataCaptureService.saveBankDraft(request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Draft saved",
                "data", data));
    }

    @PostMapping("/bank/draft/get")
    public ResponseEntity<Map<String, Object>> getBankDraft(@RequestBody DataCaptureBankDTO request) {
        DataCaptureBankDTO data = dataCaptureService.getBankDraft(request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "success",
                "data", data));
    }

    @PostMapping("/games/draft/save")
    public ResponseEntity<Map<String, Object>> saveGameDraft(@RequestBody DataCaptureBankDTO request) {
        DataCaptureBankDTO data = dataCaptureService.saveGameDraft(request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Draft saved",
                "data", data));
    }

    @PostMapping("/games/draft/get")
    public ResponseEntity<Map<String, Object>> getGameDraft(@RequestBody DataCaptureBankDTO request) {
        DataCaptureBankDTO data = dataCaptureService.getGameDraft(request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "success",
                "data", data));
    }
}

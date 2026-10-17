package com.eazycount.dto;

import com.eazycount.entity.Process;
import com.eazycount.entity.ProcessDay;
import com.eazycount.entity.ProcessDescription;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProcessDTO {

    private Integer id;
    private Process process;
    private List<ProcessDescription> processDescriptions;
    private List<ProcessDay> processDays;
    private String currencyCode;

    private Integer tenantId;
    private Process.Category category;
    private String code;
    private Integer currencyId;
    private List<Integer> descriptionIds;
    private List<Integer> dayOfWeeks; // 1=Mon … 7=Sun
    private String removeWord;
    private String replaceWordFrom;
    private String replaceWordTo;
    private String remark;
    private Boolean enableSaveDraft;

    /** Copy From: id of an existing process to deep-copy fields/descriptions/days/formulas from. Add-process only. */
    private Integer copyFromProcessId;

    /**
     * Process > Auto Fetch: the report website this process reads its Data Capture Table from. Sent by the form to set
     * it up (or with enabled=false to switch it off); read back without the password / PIN. null leaves it as it is.
     */
    private ProcessAutoFetchDTO autoFetch;
}

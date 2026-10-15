package com.eazycount.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** One description of one process, as the batched process-list query returns it (the description plus the process it belongs to). */
@Getter
@Setter
@NoArgsConstructor
public class ProcessDescriptionRow {
    private Integer processId;
    private Integer id;
    private Integer tenantId;
    private String name;
    private LocalDateTime createdAt;
}

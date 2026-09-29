package com.eazycount.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDateTime;

/**
 * Maps to {@code process_description} — per-tenant description dictionary / templates.
 */
@Getter
@Setter
@ToString
@NoArgsConstructor
@AllArgsConstructor
public class ProcessDescription {

    private Integer id;

    private Integer tenantId;

    private String name;

    private LocalDateTime createdAt;
}

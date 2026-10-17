package com.eazycount.dao;

import com.eazycount.entity.ProcessAutoFetch;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ProcessAutoFetchDao {

    /** Every Auto Fetch row of the tenant (the Process list shows them, without the secrets). */
    List<ProcessAutoFetch> findByTenantId(@Param("tenantId") Integer tenantId);

    ProcessAutoFetch findByProcessId(@Param("processId") Integer processId, @Param("tenantId") Integer tenantId);

    /** Insert, or update the row the process already has (one per process). */
    void upsert(ProcessAutoFetch row);

    void updateEnabled(@Param("processId") Integer processId, @Param("tenantId") Integer tenantId,
                       @Param("enabled") boolean enabled, @Param("updatedBy") String updatedBy);
}

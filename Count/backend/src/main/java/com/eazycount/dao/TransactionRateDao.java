package com.eazycount.dao;

import com.eazycount.entity.TransactionRate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TransactionRateDao {

    void insert(TransactionRate row);

    int deleteByTenantIdAndGroupIds(
            @Param("tenantId") Integer tenantId,
            @Param("groupIds") List<String> groupIds);
}

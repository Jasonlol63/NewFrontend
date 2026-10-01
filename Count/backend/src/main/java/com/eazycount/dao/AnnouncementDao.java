package com.eazycount.dao;


import com.eazycount.entity.Announcements;
import com.eazycount.entity.Maintenance;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface AnnouncementDao {
    List<Announcements> findAllAnnouncement();

    List<Maintenance> findAllMaintenance();

    List<Announcements> findDashboardAnnouncements();

    List<Maintenance> findMaintenanceInLogin();

    Announcements findAnnouncementById(Integer id);

    Maintenance findMaintenanceById(Integer id);

    void addAnnouncement(Announcements announcements);

    void updateAnnouncement(Announcements announcements);

    void deleteAnnouncement(Announcements announcements);

    void addMaintenance(Maintenance maintenance);

    void updateMaintenance(Maintenance maintenance);

    void deleteMaintenance(Maintenance maintenance);

    /* Execute Mark Read Function in Announcement */
    int countUnreadAnnouncements(@Param("userType") String userType, @Param("userId") Integer userId);

    void markAnnouncementsRead(@Param("userType") String userType, @Param("userId") Integer userId);

}

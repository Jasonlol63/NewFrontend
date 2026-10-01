package com.eazycount.service;

import com.eazycount.entity.Announcements;
import com.eazycount.entity.Maintenance;

import java.util.List;

public interface AnnouncementService {
    List<Announcements> findAllAnnouncement();

    List<Maintenance> findAllMaintenance();

    List<Announcements> findDashboardAnnouncements();

    List<Maintenance> findMaintenanceInLogin();

    void addAnnouncement(Announcements announcements);

    void updateAnnouncement(Announcements announcements);

    void deleteAnnouncement(Announcements announcements);

    void addMaintenance(Maintenance maintenance);

    void updateMaintenance(Maintenance maintenance);

    void deleteMaintenance(Maintenance maintenance);

    // Unread announcement count for the logged-in account (0 for IT operators).
    int countUnreadAnnouncements();

    // Marks all current announcements as read for the logged-in account (no-op for IT operators).
    void markAnnouncementsRead();
}

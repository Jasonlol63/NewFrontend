package com.eazycount.autofetch;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/*
 * The report-website sessions of Auto Fetch, in memory (a restart only means the validation code is asked again):
 *  - signed in: one per website account (site + username), shared by every process that uses that account;
 *  - pending: a login form waiting for the validation code a person is typing, under a one-time ticket;
 *  - failures: refused logins per account. After MAX_FAILURES in a row the account is left alone for BLOCK_FOR, so a
 *    wrong saved password cannot keep hitting the site (and get the account locked there).
 */
@Component
public class AutoFetchSessions {

    static final int MAX_FAILURES = 5;
    static final Duration BLOCK_FOR = Duration.ofMinutes(15);
    private static final Duration SIGNED_IN_IDLE = Duration.ofHours(6);
    private static final Duration PENDING_FOR = Duration.ofMinutes(10);

    private record Pending(String accountKey, CitibetSession session, Instant createdAt) {
    }

    private static final class Failures {
        int count;
        Instant blockedUntil;
    }

    private final Map<String, CitibetSession> signedIn = new ConcurrentHashMap<>();
    private final Map<String, Pending> pending = new ConcurrentHashMap<>();
    private final Map<String, Failures> failures = new ConcurrentHashMap<>();

    public static String accountKey(String siteUrl, String username) {
        return siteUrl.toLowerCase() + "|" + username.trim().toLowerCase();
    }

    /** The signed-in session of the account, or null when there is none (or it has expired). */
    public CitibetSession signedIn(String accountKey) {
        CitibetSession s = signedIn.get(accountKey);
        if (s != null && !s.isSignedIn()) {
            signedIn.remove(accountKey, s);
            return null;
        }
        return s;
    }

    public void keepSignedIn(String accountKey, CitibetSession session) {
        signedIn.put(accountKey, session);
    }

    /** Drops the session and gives the sitting back to the website (it only keeps one per account). */
    public void forget(String accountKey) {
        CitibetSession dropped = signedIn.remove(accountKey);
        if (dropped != null) {
            dropped.logout();
        }
    }

    /** Keeps an open login form until its validation code comes back; returns the ticket the answer must carry. */
    public String addPending(String accountKey, CitibetSession session) {
        // An earlier unfinished login form for this account is given back first, so one account never stacks up
        // several sittings on the website.
        pending.entrySet().removeIf(e -> {
            if (!e.getValue().accountKey().equals(accountKey)) {
                return false;
            }
            e.getValue().session().logout();
            return true;
        });
        String ticket = UUID.randomUUID().toString();
        pending.put(ticket, new Pending(accountKey, session, Instant.now()));
        return ticket;
    }

    /** The open login form of a ticket (left in place: a new image can be asked for it), null when unknown or expired. */
    public CitibetSession peekPending(String ticket, String accountKey) {
        Pending p = ticket == null ? null : pending.get(ticket);
        if (p == null || !p.accountKey().equals(accountKey) || expired(p)) {
            return null;
        }
        return p.session();
    }

    /** The open login form of a ticket, taken out (a ticket is answered once), null when unknown or expired. */
    public CitibetSession takePending(String ticket, String accountKey) {
        CitibetSession s = peekPending(ticket, accountKey);
        if (s != null) {
            pending.remove(ticket);
        }
        return s;
    }

    /** null when the account may try to sign in, else the minutes left before it may. */
    public Long blockedMinutes(String accountKey) {
        Failures f = failures.get(accountKey);
        if (f == null || f.blockedUntil == null) {
            return null;
        }
        Duration left = Duration.between(Instant.now(), f.blockedUntil);
        if (left.isNegative() || left.isZero()) {
            failures.remove(accountKey);
            return null;
        }
        return Math.max(1, (left.toSeconds() + 59) / 60);
    }

    public void recordFailure(String accountKey) {
        Failures f = failures.computeIfAbsent(accountKey, k -> new Failures());
        synchronized (f) {
            f.count++;
            if (f.count >= MAX_FAILURES) {
                f.blockedUntil = Instant.now().plus(BLOCK_FOR);
                f.count = 0;
            }
        }
    }

    public void clearFailures(String accountKey) {
        failures.remove(accountKey);
    }

    private static boolean expired(Pending p) {
        return Duration.between(p.createdAt(), Instant.now()).compareTo(PENDING_FOR) > 0;
    }

    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    void evict() {
        Instant now = Instant.now();
        signedIn.entrySet().removeIf(e -> {
            CitibetSession s = e.getValue();
            if (s.isSignedIn() && Duration.between(s.lastUsed(), now).compareTo(SIGNED_IN_IDLE) <= 0) {
                return false;
            }
            // Signed out as it is dropped, so the website does not keep the account occupied.
            s.logout();
            return true;
        });
        // A login form nobody finished still holds a sitting on the site; give those back too.
        pending.entrySet().removeIf(e -> {
            if (!expired(e.getValue())) {
                return false;
            }
            e.getValue().session().logout();
            return true;
        });
        failures.entrySet().removeIf(e -> e.getValue().blockedUntil != null && e.getValue().blockedUntil.isBefore(now));
    }
}

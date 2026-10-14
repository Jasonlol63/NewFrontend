package com.eazycount.mail;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class PasswordResetMailService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetMailService.class);

    private final JavaMailSender mailSender;

    // Mail goes out on its own thread: the reset request answers at the same speed whether or not an account was found,
    // so the response time cannot be used to tell if an email has an account.
    private final ExecutorService mailExecutor = Executors.newFixedThreadPool(2, runnable -> {
        Thread thread = new Thread(runnable, "password-reset-mail");
        thread.setDaemon(true);
        return thread;
    });

    @Value("${app.mail.from}")
    private String fromAddress;

    public PasswordResetMailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @PreDestroy
    void shutdown() {
        mailExecutor.shutdown();
    }

    //Sends the TAC by email. Failures are logged, not thrown — the caller must not let SMTP outages leak account existence.
    public void sendResetCode(String toEmail, String code) {
        mailExecutor.execute(() -> send(toEmail, "EazyCount Password Reset Code",
                "Your password reset verification code is: " + code
                        + "\nThis code expires in 15 minutes. If you did not request this, you can ignore this email."));
    }

    //Tells the account's email that its password was just changed.
    public void sendPasswordChangedNotice(String toEmail) {
        mailExecutor.execute(() -> send(toEmail, "EazyCount Password Changed",
                "The password of your EazyCount account was just reset and every signed-in session was ended."
                        + "\nIf this was not you, please contact support right away."));
    }

    private void send(String toEmail, String subject, String text) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(text);
        try {
            mailSender.send(message);
        } catch (MailException e) {
            log.warn("Failed to send \"{}\" email to {}", subject, toEmail, e);
        }
    }
}

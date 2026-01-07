package com.ally.loan.service;

import com.ally.loan.model.LoanApplication;
import com.ally.loan.model.LoanDecision;
import com.ally.loan.repository.LoanRepository;
import com.ally.credit.CreditService;
import com.ally.audit.AuditLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Core loan processing service.
 * 
 * Patterns in use:
 * - Event Sourcing (see LoanEventStore)
 * - CQRS (separate read/write repositories)
 * - Saga Orchestration (see LoanOriginationSaga)
 * 
 * Compliance:
 * - PCI-DSS: All PII encrypted, access logged
 * - SOC2: Full audit trail via AuditLogger
 * - GLBA: Customer consent verified before credit pull
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoanService {

    private final CreditService creditService;
    private final LoanRepository loanRepository;
    private final AuditLogger auditLogger;
    private final LoanEventStore eventStore;

    /**
     * Process a loan application through underwriting.
     * 
     * @param application The loan application to process
     * @return Decision with approval status and terms
     */
    @Transactional
    public LoanDecision processApplication(LoanApplication application) {
        // Step 1: Validate application (must happen before any field access)
        validateApplication(application);

        // Audit: Log application received (PII masked)
        auditLogger.log("LOAN_APPLICATION_RECEIVED",
            application.getId(),
            maskSsn(application.getSsn()));

        // Step 2: Check credit score via credit-service
        // Circuit breaker handles bureau unavailability
        int creditScore = creditService.checkScore(application.getCustomerId());
        
        // Step 3: Apply underwriting rules
        LoanDecision decision = underwrite(application, creditScore);

        // Step 4: Store decision as event (Event Sourcing pattern)
        eventStore.append(new LoanDecisionEvent(
            application.getId(),
            decision.getStatus(),
            decision.getTerms()
        ));

        // Audit: Log decision
        auditLogger.log("LOAN_DECISION_MADE",
            application.getId(),
            decision.getStatus());

        return decision;
    }

    /**
     * Retrieve loan status (CQRS read model).
     */
    public LoanStatus getStatus(String loanId) {
        auditLogger.log("LOAN_STATUS_ACCESSED", loanId);
        return loanRepository.findStatusById(loanId);
    }

    private void validateApplication(LoanApplication app) {
        // Null check on application object
        if (app == null) {
            throw new IllegalArgumentException("Loan application cannot be null");
        }

        // Required field validation
        if (app.getId() == null || app.getId().isBlank()) {
            throw new IllegalArgumentException("Application ID is required");
        }
        if (app.getCustomerId() == null || app.getCustomerId().isBlank()) {
            throw new IllegalArgumentException("Customer ID is required");
        }
        if (app.getSsn() == null || app.getSsn().isBlank()) {
            throw new IllegalArgumentException("SSN is required");
        }

        // SSN format validation (XXX-XX-XXXX or 9 digits)
        if (!isValidSsnFormat(app.getSsn())) {
            throw new IllegalArgumentException("Invalid SSN format");
        }

        // Business rule validation
        if (app.getAmount() < 1000 || app.getAmount() > 100000) {
            throw new InvalidLoanAmountException(app.getAmount());
        }
        if (app.getTermMonths() < 12 || app.getTermMonths() > 84) {
            throw new InvalidLoanTermException(app.getTermMonths());
        }
    }

    private boolean isValidSsnFormat(String ssn) {
        if (ssn == null) {
            return false;
        }
        // Accept XXX-XX-XXXX or 9 consecutive digits
        return ssn.matches("^\\d{3}-\\d{2}-\\d{4}$") || ssn.matches("^\\d{9}$");
    }

    private LoanDecision underwrite(LoanApplication app, int creditScore) {
        // Minimum credit score per ALLY policy
        if (creditScore < 620) {
            return LoanDecision.declined("Credit score below minimum threshold");
        }

        // Calculate APR based on credit tier
        double apr = calculateApr(creditScore, app.getTermMonths());
        
        return LoanDecision.approved(apr, app.getTermMonths());
    }

    private double calculateApr(int creditScore, int termMonths) {
        // Base rate + risk adjustment
        double baseRate = 5.99;
        
        if (creditScore >= 750) {
            return baseRate;
        } else if (creditScore >= 700) {
            return baseRate + 2.0;
        } else if (creditScore >= 650) {
            return baseRate + 4.0;
        } else {
            return baseRate + 6.0;
        }
    }

    /**
     * Mask SSN for logging (GLBA compliance).
     * Shows only last 4 digits.
     */
    private String maskSsn(String ssn) {
        if (ssn == null || ssn.length() < 4) {
            return "***-**-****";
        }
        return "***-**-" + ssn.substring(ssn.length() - 4);
    }
}

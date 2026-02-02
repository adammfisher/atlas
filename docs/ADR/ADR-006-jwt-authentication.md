# ADR-006: JWT-Based Authentication

## Status

Accepted

## Date

2025-12-01

## Context

ATLAS requires user authentication to:
1. Isolate user data (sessions, projects, artifacts)
2. Track usage for compliance and billing
3. Support session persistence across browser refreshes
4. Enable future role-based access control
5. Work with serverless architecture (no session server)

Requirements:
- Stateless (no server-side session store required)
- Works with Lambda functions
- Secure against common attacks (XSS, CSRF)
- Reasonable token lifetime with refresh capability
- Simple implementation (MVP scope)

Options considered:
- JWT tokens
- AWS Cognito
- Session cookies with DynamoDB store
- OAuth 2.0 / OpenID Connect

## Decision

We will use **JWT (JSON Web Tokens)** for authentication with the following design:

### Token Structure

```javascript
// Payload
{
  "userId": "usr_abc123def456",  // Unique user identifier
  "username": "jsmith",          // Login username
  "displayName": "John Smith",   // Display name
  "role": "user",                // Role: "user" or "admin"
  "iat": 1706000000,             // Issued at timestamp
  "exp": 1706086400              // Expiration (24 hours)
}
```

### Implementation Details

| Aspect | Decision |
|--------|----------|
| Algorithm | HS256 (HMAC-SHA256) |
| Secret storage | AWS SSM Parameter Store (SecureString) |
| Token lifetime | 24 hours |
| Delivery | HTTP-only cookie + Authorization header support |
| Password hashing | bcrypt with cost factor 12 |
| User ID format | `usr_` + nanoid(12) |

### Authentication Flow

```
1. Login Request
   POST /api/auth/login
   {"username": "...", "password": "..."}

2. Server Validates
   - Lookup user by username (GSI)
   - bcrypt.compare(password, hash)

3. Token Generation
   - Sign JWT with secret from SSM
   - Set HTTP-only cookie
   - Return user profile

4. Authenticated Requests
   - Cookie automatically sent
   - OR Authorization: Bearer <token>

5. Token Validation
   - authenticateRequest() in authMiddleware.js
   - Verify signature and expiration
   - Extract userId for data isolation
```

### Security Measures

| Measure | Implementation |
|---------|----------------|
| Password hashing | bcrypt cost 12 (~250ms per hash) |
| Token signature | HMAC-SHA256 with secret |
| Secret rotation | SSM parameter versioning |
| HTTP-only cookie | Prevents XSS token theft |
| Cookie flags | Secure, SameSite=Lax |
| Token expiration | 24-hour lifetime |

## Consequences

### Positive

- **Stateless**: No session store to manage; scales infinitely
- **Simple**: Single dependency (jsonwebtoken), straightforward code
- **Fast**: No database lookup on every request (token self-contained)
- **Lambda-friendly**: No sticky sessions or connection pooling needed
- **Debuggable**: Token payload visible (but not modifiable)

### Negative

- **No revocation**: Cannot invalidate tokens before expiration (mitigated by short lifetime)
- **Token size**: JWT larger than session ID (but minimal at ~500 bytes)
- **Secret management**: Single secret is single point of failure
- **No refresh flow**: User must re-login after 24 hours (acceptable for MVP)

### Compliance Impact

- **SOC2**: Auth events logged; password policy enforceable; MFA can be added
- **PCI-DSS**: Passwords hashed with strong algorithm; no plaintext storage
- **GLBA**: User identity established; audit trail per userId
- **Audit**: Login/logout events captured with timestamp and IP

## Alternatives Considered

### Alternative 1: AWS Cognito

Managed authentication service with user pools.

**Rejected because:**
- Additional service complexity
- Overkill for current user base
- Would add latency (Cognito API calls)
- Migration path available if needed later

### Alternative 2: Session Cookies with DynamoDB

Traditional session IDs stored in DynamoDB.

**Rejected because:**
- Database lookup on every request
- Session store management overhead
- Scaling concerns with high-traffic reads
- Additional DynamoDB cost

### Alternative 3: OAuth 2.0 / OIDC with Okta/Azure AD

Enterprise identity provider integration.

**Rejected because:**
- Significant integration complexity
- Dependency on enterprise IdP availability
- Not needed for initial deployment
- Can be added as future enhancement (Enterprise SSO)

### Alternative 4: API Keys

Static API keys per user for authentication.

**Rejected because:**
- No built-in expiration
- Key management complexity
- Not suitable for browser-based app
- Security risk if keys leaked

## Future Considerations

1. **Token refresh**: Add refresh token flow to extend sessions without re-login
2. **Enterprise SSO integration**: SAML/OIDC integration with corporate IdP
3. **MFA**: Add TOTP or WebAuthn for sensitive operations
4. **Role-based access**: Expand role system beyond user/admin
5. **Session management**: Allow users to view/revoke active sessions

## References

- [JWT Specification (RFC 7519)](https://tools.ietf.org/html/rfc7519)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [bcrypt.js](https://github.com/dcodeIO/bcrypt.js)
- [Auth Lambda Implementation](/atlas-web/lambda/functions/auth/index.js)

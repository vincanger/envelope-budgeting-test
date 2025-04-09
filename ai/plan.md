# Implementation Plan: Envelope Budgeting App

## Overview
This plan outlines the implementation of the envelope budgeting app using a **modified vertical slice approach**, optimized for LLM-assisted development. Each phase builds upon the previous, with clear dependencies and testing points.

## Phase 1: Foundation
### 1.1 Data Models
- [x] Implement core Prisma models:
  - [x] User (extend existing)
  - [x] BudgetProfile
  - [x] Envelope
  - [x] Transaction
- [x] Add necessary indexes and relations
- [x] Implement cascade delete behaviors

### 1.2 Basic Auth Flow
- [x] Configure Wasp auth with `email` method (using `Dummy` provider for development)
- [x] Implement password reset flow (using default Wasp mechanism)
- [x] Add email verification handling (using default Wasp mechanism)
- [x] Implement basic user profile management

### 1.3 Core Operations
- [x] Create basic CRUD operations for:
  - [x] Budget profile management (Note: creation must link `ownerId` to `context.user.id`)
  - [x] User profile updates
- [x] Implement basic error handling
- [x] Add input validation

### 1.4 Basic UI Components
- [x] Create layout components
- [x] Implement navigation
- [x] Add basic forms for:
  - [x] Profile creation
  - [x] Profile settings
- [x] Set up error boundaries

## Phase 2: Core Budgeting
### 2.1 Envelope Management
- [x] Implement envelope CRUD operations
- [x] Add envelope categorization (Basic)
- [ ] Create envelope templates (Deferred)
- [x] Implement envelope archiving (Basic)

### 2.2 Transaction Basics
- [x] Add basic transaction CRUD
- [x] Implement transaction categorization (via Envelope)
- [x] Create transaction history view (Basic)
- [ ] Add basic transaction search (Deferred)

### 2.3 Budget Calculations
- [x] Implement envelope balance tracking
- [x] Add basic budget vs. actual calculations (Basic display)
- [ ] Create simple spending analytics (Deferred)
- [x] Implement basic data validation

### 2.4 Enhanced UI
- [x] Create envelope management interface (Basic)
- [x] Add transaction entry forms
- [x] Implement basic dashboard
- [x] Add loading states and error handling (Basic)

## Phase 3: User Management
### 3.1 Enhanced Auth
- [x] Check that Wasp's email and password Auth is implemented correctly.

### 3.2 User Roles
- [x] Add role-based access control (Backend: role field, checks)
- [x] Implement permission system (Backend: basic hierarchy)
- [x] Create role management interface (Basic: Member viewing page created)
- [x] Add role-based UI elements (Basic: Disable actions based on role)

### 3.3 Collaboration
- [x] Implement user invitations (Backend action, signup hook for acceptance)
- [x] Add member management (Basic: View members, Revoke pending invites)
- [ ] Create shared access controls (Deferred)
- [ ] Implement real-time updates (Deferred)

### 3.4 User Settings
- [ ] Add notification preferences (Deferred)
- [ ] Implement currency settings (Deferred)
- [x] Create profile customization
- [ ] Add user activity tracking (Deferred)

## Phase 4: Advanced Features
### 4.1 Transaction Types
- Add recurring transactions
- Implement transaction transfers
- [x] Create bulk transaction import
- Add transaction scheduling

### 4.2 Enhanced Envelopes
- Add envelope transfers
- Implement envelope rules
- Create envelope templates
- Add envelope history

### 4.3 Data Management
- [x] Add bulk operations
- Create data validation rules
- Implement data export

### 4.4 UI Enhancements
- Add advanced forms
- Implement data tables
- [x]Create interactive charts
- Add keyboard shortcuts

## Phase 5: Analytics
### 5.1 Basic Reports
- Implement monthly summaries
- Add spending trends
- Create category analysis
- Add budget comparisons

### 5.2 Advanced Analytics
- Add custom reports
- Implement data visualization
- Create predictive analytics
- Add export options

### 5.3 Report Management
- Add report scheduling
- Implement report templates
- Create report sharing
- Add report archiving

### 5.4 Dashboard
- Create interactive dashboard
- Add customizable widgets
- Implement real-time updates
- Add data filtering

## Phase 6: Polish
### 6.1 Notifications
- Implement email notifications
- Add in-app notifications
- Create notification preferences
- Add notification history

### 6.2 Performance
- Optimize database queries
- Implement caching (optional - we already use react-query)
- Add lazy loading
- Optimize bundle size

### 6.3 UX Improvements
- Add animations
- Implement responsive design
- Create accessibility features
- Add user onboarding

### 6.4 Testing & Documentation
- Add unit tests (with playwright)
- Implement integration tests (with playwright)
- Create user documentation

## Implementation Guidelines

### For Each Feature:
1. **Data Layer**
   - Define/update Prisma models
   - Add necessary indexes
   - Implement relations
   - Add validation rules

2. **Operations Layer**
   - Create Wasp operations
   - Implement error handling
   - Add input validation
   - Set up authorization

3. **UI Layer**
   - Create React components
   - Implement forms
   - Add error states
   - Create loading states

4. **Testing**
   - Add unit tests
   - Implement integration tests
   - Test error cases
   - Verify edge cases

### Code Organization
- Group features in `src/features/{featureName}`
- Keep operations in `operations.ts`
- Maintain types in `types.ts`
- Store components in `components/`

### Testing Strategy
- Unit tests for operations
- Integration tests for features
- E2E tests for critical paths
- Performance testing

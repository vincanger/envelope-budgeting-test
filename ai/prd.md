# Envelope Budgeting App PRD

## Overview
A collaborative envelope budgeting application that allows users to manage their finances using the envelope budgeting method, with support for shared access between multiple users.

## Core Features

### 1. User Management & Authentication
#### Authentication System
- Primary authentication using Wasp's built-in auth system
- Email verification required for all new accounts
- Password reset functionality with secure tokens
- Session management with configurable expiration
- Rate limiting for auth operations:
  - 1 signup request per minute per email
  - 3 password reset attempts per hour per email
  - 5 failed login attempts per 15 minutes

#### User Roles & Permissions
- Role hierarchy:
  - Primary Account Owner (full access)
  - Editor (can modify transactions and envelopes)
  - Viewer (read-only access)
- Permission inheritance:
  - Each role inherits permissions from lower roles
  - Custom permission sets can be assigned per user

#### User Profile Management
- Personal information
- Notification preferences
- Default currency setting

### 2. Budget Profile
#### Data Model
```prisma
model User {
  id              Int      @id @default(autoincrement())
  email           String   @unique
  emailVerified   Boolean  @default(false)
  password        String   // Hashed
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastLoginAt     DateTime?
  
  // Relations
  budgetProfile   BudgetProfile? @relation("OwnedProfile")
  memberProfiles  UserBudgetProfile[]
  notifications   Notification[]
  transactions    Transaction[]    @relation("CreatedTransactions")
}

model BudgetProfile {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  currency    String   @default("USD")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  owner       User     @relation("OwnedProfile", fields: [ownerId], references: [id])
  ownerId     Int      @unique  // One-to-one relation with owner
  members     UserBudgetProfile[]
  envelopes   Envelope[]
  transactions Transaction[]
}

model UserBudgetProfile {
  id              Int           @id @default(autoincrement())
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          Int
  budgetProfile   BudgetProfile @relation(fields: [budgetProfileId], references: [id], onDelete: Cascade)
  budgetProfileId Int
  role            String        @default("VIEWER") // EDITOR, VIEWER
  permissions     String[]      // Custom permissions beyond role
  joinedAt        DateTime      @default(now())
  lastAccessedAt  DateTime      @default(now())

  @@unique([userId, budgetProfileId])
  @@index([userId])
  @@index([budgetProfileId])
}
```

#### Features
- Create and manage single budget profile
- Invite users to budget profile
- Manage member permissions
- Profile settings and preferences

### 3. Envelopes (Budget Categories)
#### Data Model
```prisma
model Envelope {
  id              Int           @id @default(autoincrement())
  name            String
  budgetProfile   BudgetProfile @relation(fields: [budgetProfileId], references: [id], onDelete: Cascade)
  budgetProfileId Int
  amount          Float         @default(0)
  spent           Float         @default(0)
  category        String
  color           String?
  icon            String?
  isArchived      Boolean       @default(false)
  transactions    Transaction[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([budgetProfileId])
}
```

#### Features
- Create, edit, and delete envelopes
- Set monthly budget amounts
- Track spending within envelopes
- Transfer money between envelopes
- Categorize envelopes (e.g., Bills, Entertainment, Savings)
- Archive inactive envelopes
- Envelope templates

### 4. Transactions
#### Data Model
```prisma
model Transaction {
  id              Int           @id @default(autoincrement())
  description     String
  amount          Float
  date            DateTime
  envelope        Envelope      @relation(fields: [envelopeId], references: [id], onDelete: Restrict)
  envelopeId      Int
  budgetProfile   BudgetProfile @relation(fields: [budgetProfileId], references: [id], onDelete: Cascade)
  budgetProfileId Int
  createdBy       User          @relation("CreatedTransactions", fields: [createdById], references: [id])
  createdById     Int
  type            String        // EXPENSE, INCOME, TRANSFER
  recurring       Boolean       @default(false)
  recurringRule   String?       // For recurring transactions
  isArchived      Boolean       @default(false)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([envelopeId])
  @@index([budgetProfileId])
  @@index([createdById])
}
```

#### Features
- Add, edit, and delete transactions
- Categorize transactions by envelope
- Support for recurring transactions
- Transaction history and search
- Export transactions
- Transaction archiving
- Bulk transaction import/export

### 5. Reports and Analytics
#### Data Model
```prisma
model Report {
  id              Int           @id @default(autoincrement())
  budgetProfile   BudgetProfile @relation(fields: [budgetProfileId], references: [id], onDelete: Cascade)
  budgetProfileId Int
  type            String        // MONTHLY, CUSTOM, TREND
  parameters      Json          // Report configuration
  generatedAt     DateTime      @default(now())
  data            Json          // Report results
  createdBy       User          @relation(fields: [createdById], references: [id])
  createdById     Int

  @@index([budgetProfileId])
  @@index([createdById])
}
```

#### Features
- Monthly spending overview
- Envelope usage trends
- Category-wise analysis
- Budget vs. actual comparison
- Shared household expenses tracking
- Custom report generation
- Report scheduling
- Export reports in multiple formats

### 6. Notifications
#### Data Model
```prisma
model Notification {
  id          Int      @id @default(autoincrement())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      Int
  type        String   // INVITE, OVER_BUDGET, REMINDER, REPORT_READY
  message     String
  data        Json?    // Additional notification data
  read        Boolean  @default(false)
  readAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([userId])
}
```

#### Features
- Budget profile invitations
- Over-budget alerts
- Low balance warnings
- Monthly summary notifications
- Report completion notifications
- Custom notification preferences
- Notification history

## Technical Requirements

### API Operations
1. Budget Profile Operations
```typescript
query getBudgetProfile {
  fn: import { getBudgetProfile } from "@src/features/budgets/operations.ts",
  entities: [BudgetProfile, UserBudgetProfile]
}

action createBudgetProfile {
  fn: import { createBudgetProfile } from "@src/features/budgets/operations.ts",
  entities: [BudgetProfile, UserBudgetProfile]
}

action inviteUser {
  fn: import { inviteUser } from "@src/features/budgets/operations.ts",
  entities: [BudgetProfile, UserBudgetProfile, User]
}

action updateBudgetProfile {
  fn: import { updateBudgetProfile } from "@src/features/budgets/operations.ts",
  entities: [BudgetProfile, UserBudgetProfile]
}
```

2. Envelope Operations
```typescript
query getEnvelopes {
  fn: import { getEnvelopes } from "@src/features/envelopes/operations.ts",
  entities: [Envelope, BudgetProfile]
}

action updateEnvelope {
  fn: import { updateEnvelope } from "@src/features/envelopes/operations.ts",
  entities: [Envelope, Transaction]
}

action transferBetweenEnvelopes {
  fn: import { transferBetweenEnvelopes } from "@src/features/envelopes/operations.ts",
  entities: [Envelope, Transaction]
}
```

3. Transaction Operations
```typescript
query getTransactions {
  fn: import { getTransactions } from "@src/features/transactions/operations.ts",
  entities: [Transaction, Envelope, BudgetProfile]
}

action createTransaction {
  fn: import { createTransaction } from "@src/features/transactions/operations.ts",
  entities: [Transaction, Envelope, BudgetProfile]
}

action bulkCreateTransactions {
  fn: import { bulkCreateTransactions } from "@src/features/transactions/operations.ts",
  entities: [Transaction, Envelope, BudgetProfile]
}
```

4. Report Operations
```typescript
query getReports {
  fn: import { getReports } from "@src/features/reports/operations.ts",
  entities: [Report, BudgetProfile]
}

action generateReport {
  fn: import { generateReport } from "@src/features/reports/operations.ts",
  entities: [Report, BudgetProfile]
}

action scheduleReport {
  fn: import { scheduleReport } from "@src/features/reports/operations.ts",
  entities: [Report, BudgetProfile]
}
```

### UI/UX Requirements
- Responsive design using Tailwind CSS
- Consistent use of shadcn-ui components
- Real-time updates for shared profiles
- Intuitive navigation between envelopes
- Clear visualization of budget status
- Mobile-first design approach
- Loading states and error handling

### Security Requirements
- Role-based access control
- Secure invitation system
- Transaction history audit trail

### Error Handling
- Graceful degradation
- User-friendly error messages
- Error logging and monitoring
- Automatic retry mechanisms
- Fallback UI states
- Data recovery procedures
- Transaction rollback support

# 🏔️ ZAI Experience Club - React Web3 Application

> A luxury Alpine skiing experience platform with blockchain-based product verification, NFT membership cards, and exclusive community features built with React, TypeScript, and Web3 integration.

**Current Date**: April 23, 2026  
**Status**: 🚀 Development Phase 1  
**Last Updated**: 2026-04-23

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development Phases](#development-phases)
- [Key Features](#key-features)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## 🎯 Project Overview

The **ZAI Experience Club** is a premium digital platform for luxury ski brand ZAI that enables customers to:

- **Claim Products**: Register skis and apparel via NFC cards or serial numbers on the blockchain
- **Unlock Benefits**: Access exclusive events, factory tours, and warranty management
- **Build Community**: Connect with other ZAI owners, share experiences, and join ecosystem partners
- **Earn Rewards**: Participate in a Web3-based loyalty system with NFT badges and tier progression

### Client Requirements

- **Customer**: ZAI (luxury Alpine skiing brand, since 2003)
- **Platform**: Web application (responsive) + Mobile app (React Native)
- **Blockchain**: Polygon network with Wallettwo SDK for wallet integration
- **Key Integration**: NFC card reading, smart contract product verification, community features

### Project Goals

✅ Phase 1 (Current): Web application with core functionality  
⏳ Phase 2: Mobile app (React Native) parity  
⏳ Phase 3: NFT rewards and advanced features  
⏳ Phase 4: Production deployment and scaling  

---

## 🏗️ Architecture

### High-Level System Design


┌─────────────────────────────────────────────────────────────────┐ 
│                   ZAI Experience Club                           │ 
├─────────────────────────────────────────────────────────────────┤ 
│                                                                 │ 
│      ┌──────────────────┐ ┌──────────────────────────────┐      │ 
│      │ Frontend         │ │ Backend Services             │      │  
│      │ (React)          │ │ (Node.js/Express)            │      │  
│      │                  │ │                              │      │
│      │                  │ │                              │      │
│      │ - Dashboard      │ │ - User Management            │      │ 
│      │ - Products       │ │ - Product Registry           │      │ 
│      │ - Events         │ │ - Event Management           │      │ 
│      │ - Community      │ │ - Blockchain Orchestration   │      │ 
│      └──────────────────┘ └──────────────────────────────┘      │
│               ▲                          ▲                      │ 
└───────────────────────────────┬─────────────────────────────────┘ 
│                               │                                 │ 
│                        ┌──────▼───────┐                         │ 
│                        │   Database   │                         │ 
│                        │ (PostgreSQL) │                         │ 
│                        └──────────────┘                         │
│                                                                 │ 
│ ┌─────────────────────────────────────────────────────────────┐ │ 
│ │                  Web3 & Blockchain Layer                    │ │ 
│ ├─────────────────────────────────────────────────────────────┤ │  
│ │     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │ │ 
│ │     │ Wallettwo    │ │ Smart        │ │ IPFS/NFT     │      │ │ 
│ │     │   SDK        │ │ Contracts    │ │ Storage      │      │ │ 
│ │     │ (Auth/Txn)   │ │ (Polygon)    │ │              │      │ │ 
│ │     └──────────────┘ └──────────────┘ └──────────────┘      │ │ 
│ └─────────────────────────────────────────────────────────────┘ │ 
│                                                                 │ 
└─────────────────────────────────────────────────────────────────┘


### Monorepo Structure (Future)

We'll use a **monorepo approach** with Turbo to manage web and mobile apps:

zai-experience-club/ ├── apps/ │ ├── web/ # React web application │ └── mobile/ # React Native mobile app ├── packages/ │ ├── shared/ # Shared types, utils, hooks │ ├── ui/ # Reusable UI components │ └── blockchain/ # Web3 service layer ├── docs/ # Documentation ├── turbo.json # Turbo configuration ├── pnpm-workspace.yaml # Workspace configuration └── package.json # Root package.json


---

## 🛠️ Tech Stack

### Frontend

| Layer                 | Technology                | Purpose                   |
|-----------------------|---------------------------|---------------------------|
| **Framework**         | React 18                  | UI library                |
| **Language**          | TypeScript 5              | Type safety               |
| **Styling**           | CSS-in-JS + Tailwind      | Responsive design         |
| **Build Tool**        | Vite                      | Fast development server   |
| **State Management**  | Context API + Hooks       | App state                 |
| **Web3**              | Wallettwo SDK + ethers.js | Blockchain integration    |
| **NFC**               | Web NFC API               | Product scanning          |

### Backend (Reference)

| Layer                 | Technology        | Purpose                       |
|-----------------------|-------------------|-------------------------------|
| **Runtime**           | Node.js 20        | Server runtime                |
| **Framework**         | Express.js        | REST API                      |
| **Database**          | PostgreSQL        | Data persistence              |
| **ORM**               | Prisma            | Database queries              |
| **Authentication**    | JWT + Wallettwo   | User auth                     |
| **Blockchain**        | web3.js           | Smart contract interaction    |

### Blockchain

| Component             | Network       | Purpose                   |
|-----------------------|---------------|---------------------------|
| **Primary Chain**     | Polygon (137) | Main operations, low fees |
| **Wallet SDK**        | Wallettwo     | Secure wallet management  |
| **Contract Language** | Solidity      | Smart contracts           |
| **NFT Standard**      | ERC-721       | Membership NFTs           |
| **Token Standard**    | ERC-20        | Reward tokens             |

### DevOps & Testing

| Tool              | Purpose                           |
|-------------------|-----------------------------------|
| **Testing**       | Vitest + React Testing Library    |
| **CI/CD**         | GitHub Actions                    |
| **Deployment**    | Vercel (Frontend) + AWS (Backend) |
| **Monitoring**    | Sentry + LogRocket                |
| **Documentation** | Storybook + JSDoc                 |

---

## 📁 Project Structure (Web App)

apps/web/ ├── src/ │ ├── components/ # React components │ │ ├── Auth/ # Authentication components │ │ │ ├── WalletConnectButton.tsx │ │ │ ├── LoginModal.tsx │ │ │ ├── UserProfile.tsx │ │ │ └── LogoutButton.tsx │ │ ├── Products/ # Product management │ │ │ ├── ProductCarousel.tsx │ │ │ ├── ProductCard.tsx │ │ │ ├── ClaimProductFlow.tsx │ │ │ ├── ProductModal.tsx │ │ │ └── ProductCard.test.tsx │ │ ├── Events/ # Event management │ │ │ ├── EventCard.tsx │ │ │ ├── EventGrid.tsx │ │ │ ├── EventModal.tsx │ │ │ └── EventFilters.tsx │ │ ├── Community/ # Community features │ │ │ ├── MemberList.tsx │ │ │ ├── FeedGrid.tsx │ │ │ ├── IGConnect.tsx │ │ │ └── WhatsAppChannel.tsx │ │ ├── Layout/ # Layout components │ │ │ ├── Sidebar.tsx │ │ │ ├── Header.tsx │ │ │ ├── MobileNav.tsx │ │ │ ├── Footer.tsx │ │ │ └── MainLayout.tsx │ │ ├── Common/ # Reusable components │ │ │ ├── Button.tsx │ │ │ ├── Modal.tsx │ │ │ ├── Card.tsx │ │ │ ├── Toast.tsx │ │ │ ├── Loading.tsx │ │ │ ├── Empty.tsx │ │ │ └── Tabs.tsx │ │ └── Pages/ # Page components │ │ ├── Home.tsx │ │ ├── Dashboard.tsx │ │ ├── Products.tsx │ │ ├── Events.tsx │ │ ├── Community.tsx │ │ ├── Profile.tsx │ │ ├── Settings.tsx │ │ └── NotFound.tsx │ ├── hooks/ # Custom React hooks │ │ ├── useWalletAuth.ts │ │ ├── useProductClaim.ts │ │ ├── useNFC.ts │ │ ├── useEventManager.ts │ │ ├── useResponsive.ts │ │ ├── useLocalStorage.ts │ │ ├── useDebounce.ts │ │ └── useAsync.ts │ ├── context/ # React Context providers │ │ ├── AppContext.tsx │ │ ├── WalletContext.tsx │ │ ├── UserContext.tsx │ │ └── NotificationContext.tsx │ ├── services/ # API & business logic │ │ ├── api.ts # HTTP client │ │ ├── blockchain.ts # Web3 operations │ │ ├── nfc.ts # NFC reading │ │ ├── storage.ts # Local storage │ │ └── analytics.ts # Event tracking │ ├── types/ # TypeScript definitions │ │ ├── index.ts # Core types │ │ ├── wallet.ts # Wallet types │ │ ├── product.ts # Product types │ │ ├── event.ts # Event types │ │ └── user.ts # User types │ ├── utils/ # Utility functions │ │ ├── validators.ts # Input validation │ │ ├── formatters.ts # Data formatting │ │ ├── constants.ts # App constants │ │ ├── helpers.ts # Helper functions │ │ ├── errors.ts # Error handling │ │ └── logger.ts # Logging utility │ ├── styles/ # Global styles │ │ ├── globals.css # Global styles │ │ ├── theme.ts # Design tokens │ │ └── responsive.ts # Responsive utilities │ ├── config/ # Configuration │ │ ├── env.ts # Environment config │ │ ├── constants.ts # App constants │ │ └── blockchain.ts # Blockchain config │ ├── App.tsx # Root component │ ├── Router.tsx # Route definitions │ ├── index.tsx # Entry point │ └── main.tsx # Vite entry ├── public/ # Static assets │ ├── images/ │ ├── icons/ │ └── favicon.ico ├── tests/ # Test files │ ├── unit/ │ ├── integration/ │ └── setup.ts ├── .env.example # Example environment variables ├── tsconfig.json # TypeScript config ├── vite.config.ts # Vite config ├── vitest.config.ts # Vitest config ├── package.json └── README.md


---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.x or higher
- **pnpm** 8.x or higher (or npm/yarn)
- **Git** for version control
- **Wallettwo Account** for Web3 integration

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/zai-ski/experience-club.git
cd zai-experience-club
2. Install Dependencies
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
3. Set Up Environment Variables
#  example to .env.local
cp apps/web/.env.example apps/web/.env.local

# Edit with your values
nano apps/web/.env.local
Required Environment Variables:

# Application
VITE_APP_NAME=ZAI Experience Club
VITE_APP_URL=http://localhost:5173

# API Configuration
VITE_API_URL=http://localhost:3000
VITE_API_TIMEOUT=30000

# Wallettwo Web3
VITE_WALLETTWO_URL=https://api.wallettwo.com
VITE_COMPANY_ID=your-company-id-here
VITE_WALLETTWO_API_KEY=your-api-key

# Smart Contracts
VITE_ZAI_CONTRACT_ADDRESS=0x...
VITE_DEFAULT_CHAIN_ID=137

# Blockchain RPC Endpoints
VITE_POLYGON_RPC=https://polygon-rpc.com
VITE_ETHEREUM_RPC=https://eth-mainnet.g.alchemy.com/v2/your-key

# Features
VITE_ENABLE_NFC=true
VITE_ENABLE_RAMP=true
VITE_ENABLE_COMMUNITY=true

# Analytics & Monitoring
VITE_SENTRY_DSN=https://...
VITE_LOGROCKET_ID=...
4. Start Development Server
# Web app only
pnpm dev --filter=web

# All apps
pnpm dev

# Specific app with verbose logging
pnpm dev --filter=web -- --debug
The application will be available at http://localhost:5173

5. Verify Setup
# Type checking
pnpm type-check

# Linting
pnpm lint

# Run tests
pnpm test

# Build for production
pnpm build
📈 Development Phases
Phase 1: Core Web Application ✅ CURRENT
Duration: Weeks 1-4 | Status: In Progress

Objectives:

✅ Project setup and structure
✅ Core type definitions
✅ Custom hooks (Wallet, NFC, Product Claim)
✅ Context providers
✅ API service layer
✅ Blockchain service layer
🔄 Authentication components
🔄 Product management pages
🔄 Event management pages
🔄 Community features
🔄 User profile & settings
🔄 Responsive design
🔄 Testing suite
Deliverables:

Full working React web app
All core pages implemented
Wallettwo integration functional
NFC product claiming
Unit test coverage (60%+)
Phase 2: Mobile App (React Native) ⏳ UPCOMING
Duration: Weeks 5-8 | Status: Planned

Objectives:

Project setup with Expo + TypeScript
Shared code from monorepo
Native-specific implementations
Offline-first architecture
Push notifications
Mobile-optimized UI
Deep linking support
Deliverables:

iOS and Android apps
App Store & Google Play builds
Feature parity with web
Native push notifications
Offline product data
Phase 3: NFT & Advanced Features ⏳ UPCOMING
Duration: Weeks 9-12 | Status: Planned

Objectives:

NFT membership card minting
Dynamic reward system
Tier progression mechanics
Token-based rewards
Gamification elements
Advanced analytics
Deliverables:

NFT smart contracts
Minting UI flow
Reward tracking dashboard
Leaderboard system
Advanced event mechanics
Phase 4: Production & Scaling ⏳ UPCOMING
Duration: Weeks 13-16 | Status: Planned

Objectives:

Performance optimization
Security audits
Smart contract audits
Load testing
Production deployment
Monitoring & alerting
Deliverables:

Production-ready codebase
Deployed web app
Deployed mobile apps
Monitoring dashboard
Security documentation
✨ Key Features
🔐 Authentication & Wallet Management
Wallettwo SDK integration for secure wallet access
Multi-chain support (Polygon primary)
Automatic session management
Token refresh & expiration handling
📦 Product Management
NFC Card Scanning: Tap to claim with Web NFC API
Serial Number Entry: Manual product registration
Blockchain Verification: Smart contract validation
Warranty Tracking: Insurance activation & management
Product History: View all claimed items
🎯 Event System
Event Discovery: Browse exclusive member events
Registration Management: Track confirmed & past events
Tier-Based Access: Different events for different tier levels
Event Reminders: Push notifications for upcoming events
Event Analytics: Attendance tracking
👥 Community Features
Member Directory: Connect with other ZAI owners
Instagram Integration: Share mountain photos
WhatsApp Channel: Official updates channel
Community Feed: User-generated content gallery
Member Stats: Location, join date, product count
👤 User Profiles
Personal Information: Name, location, preferences
Membership Status: Tier level and benefits
Product Collection: All claimed items
Event History: Past and upcoming events
Account Settings: Privacy, notifications, region
⚙️ Account Settings
Notification Preferences: Email & push controls
NFC Card Management: Card status & replacement
Privacy Controls: Data sharing & visibility
Region & Currency: Localization settings
Security: Password, 2FA, session management
📊 Database Schema (Reference)
Users
├── id (UUID)
├── email (String, unique)
├── walletAddress (String, unique)
├── firstName (String)
├── lastName (String)
├── tier (Enum: silver, gold, platinum, atelier)
├── nfcCardId (String, optional)
├── createdAt (DateTime)
└── updatedAt (DateTime)

Products
├── id (UUID)
├── userId (FK: Users)
├── serialNumber (String, unique)
├── category (Enum: skis, apparel, accessories)
├── purchaseDate (DateTime)
├── warrantyExpiry (DateTime)
├── insuranceActive (Boolean)
├── blockchainTxHash (String)
├── nfcTagId (String, optional)
├── claimedAt (DateTime)
└── updatedAt (DateTime)

Events
├── id (UUID)
├── title (String)
├── description (Text)
├── type (Enum: demo, factory, partner, community)
├── location (String)
├── startDate (DateTime)
├── endDate (DateTime)
├── tier (Enum: silver, gold, platinum, atelier)
├── capacity (Integer)
└── createdAt (DateTime)

EventRegistrations
├── id (UUID)
├── eventId (FK: Events)
├── userId (FK: Users)
├── registeredAt (DateTime)
└── status (Enum: confirmed, cancelled, attended)

NFTs
├── id (UUID)
├── userId (FK: Users)
├── tokenId (String, unique)
├── tier (String)
├── contractAddress (String)
├── blockchainTxHash (String)
├── mintedAt (DateTime)
└── metadata (JSON)
🧪 Testing Strategy
Unit Tests
Component rendering & interaction
Custom hooks behavior
Utility functions
Type checking
Integration Tests
API service calls
Context provider state management
Wallet authentication flow
Product claiming workflow
E2E Tests
Complete user journeys
Responsive design verification
Cross-browser compatibility
Performance benchmarks
Test Coverage Goals
Phase 1: 60% coverage
Phase 2: 75% coverage
Phase 3: 85% coverage
Phase 4: 90%+ coverage
🚀 Deployment
Development
pnpm dev
Staging
pnpm build
pnpm preview
Production
# Build
pnpm build

# Deploy to Vercel (configured)
vercel --prod

# Or Docker
docker build -t zai-experience-club .
docker run -p 3000:3000 zai-experience-club
Environment Strategy
Environment	URL	Database	Blockchain	Status
Development	localhost:5173	Local	Polygon Testnet	🔄 In Progress
Staging	staging.zaiclub.com	Cloud	Polygon Testnet	⏳ Upcoming
Production	club.zai.ch	Cloud	Polygon Mainnet	⏳ Planned
📚 Documentation
Generated Documentation
Storybook: Component library (Phase 2)
API Docs: OpenAPI/Swagger specification
Blockchain Docs: Smart contract ABIs and functions
Development Guides
Setup Guide: Getting started
Architecture Guide: System design
Component Guide: Building new components
Testing Guide: Writing tests
Deployment Guide: Release process
🐛 Known Issues & Limitations
Phase 1
 NFC API only works on Android with Chrome (browser limitation)
 Wallet connection requires user to be online
 No offline mode yet
 Mobile responsive styles incomplete
Upcoming
 Multi-chain support (currently Polygon only)
 Advanced caching strategy
 Real-time notifications
 Video content support
🤝 Contributing
Development Workflow
Create Feature Branch
git checkout -b feature/feature-name
Make Changes
# Run type check
pnpm type-check

# Run linter
pnpm lint --fix

# Run tests
pnpm test
Commit
git commit -m "feat: add feature description"
Push & Create PR
git push origin feature/feature-name
Code Standards
TypeScript strict mode enabled
ESLint + Prettier for formatting
Conventional commits
Component composition over inheritance
Hooks-based functional components
Review Process
Peer review required before merge
CI/CD checks must pass
Test coverage must meet minimum
Documentation must be updated
📦 Scripts Reference
# Development
pnpm dev              # Start dev server
pnpm dev:debug       # Debug mode
pnpm dev --filter=web # Web only

# Testing
pnpm test            # Run all tests
pnpm test:watch     # Watch mode
pnpm test:coverage  # Coverage report

# Code Quality
pnpm lint           # Lint all files
pnpm lint:fix       # Fix linting issues
pnpm type-check     # TypeScript check
pnpm format         # Format code with Prettier

# Building
pnpm build          # Build all apps
pnpm build:web      # Build web only
pnpm preview        # Preview production build

# Deployment
pnpm deploy:staging # Deploy to staging
pnpm deploy:prod    # Deploy to production

# Documentation
pnpm docs:build     # Build docs
pnpm docs:dev       # Dev docs server

# Utilities
pnpm clean          # Clean node_modules & build
pnpm reinstall      # Clean install
pnpm update-deps    # Update dependencies

📞 Support & Contact
Project Lead: [Contact]
Team Email: team@zaiclub.com
Documentation: https://docs.zaiclub.com
Issue Tracker: GitHub Issues
📄 License
This project is proprietary software for ZAI AG. All rights reserved.

🗺️ Roadmap
2026 Q2 (NOW)
├── Phase 1: Web App Core
│   ├── Week 1-2: Setup & Architecture ✅
│   ├── Week 3-4: Core Components 🔄
│   └── Week 4: Testing & Docs
│
2026 Q3
├── Phase 2: Mobile App (React Native)
│   ├── Expo + TypeScript Setup
│   ├── Native Implementation
│   └── App Store Release
│
2026 Q4
├── Phase 3: NFT & Advanced Features
│   ├── Smart Contract Development
│   ├── NFT Minting System
│   └── Gamification Engine
│
2027 Q1
└── Phase 4: Production & Scale
    ├── Security Audits
    ├── Performance Optimization
    └── Global Rollout
🔍 Quick Reference
API Endpoints: /docs/api.md
Component Library: Storybook (Phase 2)
Type Definitions: src/types/
Testing Guide: /docs/testing.md
Deployment: /docs/deployment.md

Version: 1.0.0
Last Updated: April 23, 2026
Next Review: May 7, 2026


---

## Summary

I've created a comprehensive **README.md** that serves as our complete reference point. Here's what it covers:

### 📋 **What's Included**:

1. **Project Overview** - Goals, requirements, status
2. **Architecture** - System design diagrams, monorepo structure
3. **Tech Stack** - Complete breakdown of technologies
4. **Project Structure** - Detailed file organization with explanations
5. **Getting Started** - Setup instructions step-by-step
6. **Development Phases** - Clear timeline for all 4 phases
7. **Key Features** - What we're building
8. **Database Schema** - Data model reference
9. **Testing Strategy** - Coverage goals and approach
10. **Deployment** - Environment strategy
11. **Scripts** - Complete command reference
12. **Roadmap** - Timeline visualization

### 🎯 **Key Information**:

- **Current Phase**: Phase 1 (Core Web Application)
- **Current Week**: Week 1-2 (Setup & Architecture)
- **Next Milestone**: Complete core components (Week 3-4)
- **Full Timeline**: 16 weeks (4 months)
- **Team Structure**: Foundation for collaboration

### ✅ **Starting Point Confirmed**:

We have successfully established:
- ✅ Project structure & organization
- ✅ Type definitions
- ✅ Custom hooks
- ✅ Service layers
- ✅ Context providers
- ⏳ Next: Page Components (Dashboard, Products, Events, Community, Profile, Settings)

---

## **Shall we proceed to Phase 1 - Building the Page Components?**

I'm ready to build:

1. **Home Page** - Hero section with CTAs
2. **Dashboard** - User overview & quick actions
3. **Products Page** - Product carousel & details
4. **Events Page** - Event listing & registration
5. **Community Page** - Member list & feed
6. **Profile Page** - User information editing
7. **Settings Page** - Account preferences

Should I start with these page components? 🚀
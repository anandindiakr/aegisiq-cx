# Aegis Intelligence CX

AegisIQ CX™ — Prompt 1: Enterprise Foundation & Multi-Tenant Platform

You are a Senior Enterprise SaaS Architect, Principal UX Designer, and Lead Full-Stack Engineer.

Build the first production-ready version of AegisIQ CX™, an enterprise-grade AI-powered Customer Experience Intelligence Platform.

Do not build a prototype. Build a scalable SaaS foundation that can grow into a commercial enterprise product.

Product Vision

AegisIQ CX™ transforms CCTV audio and customer conversations into searchable business intelligence.

The platform is designed for:

 Retail chains

 Banks

 Healthcare

 Government service centers

 Hospitality

 Airports

 Enterprise customer service operations

The first customer is a retail chain, but the platform must be configurable for future industries.

Core Principles

 Enterprise UI

 Premium look and feel

 Fast performance

 Responsive

 Multi-tenant

 Cloud-first

 AI-native

 Modular architecture

 White-label ready

 Production quality only

No placeholder UI.

No lorem ipsum.

No toy dashboards.

Technology Stack

Frontend:

 React

 TypeScript

 Tailwind CSS

 ShadCN UI

 React Router

 TanStack Query

 Recharts

 Framer Motion

Backend:

 Supabase

 PostgreSQL

 Row Level Security

 Edge Functions

 Storage

Architecture:

 Modular feature-based folders

 Clean code

 Reusable components

 Strict TypeScript

 Mobile responsive

Branding

Application Name:

AegisIQ CX™

Subtitle:

AI Customer Experience Intelligence Platform

Primary colours:

Professional dark enterprise theme with blue accents.

Style inspiration:

Microsoft Defender

Azure Portal

Palantir

Datadog

CrowdStrike Falcon

Avoid bright consumer colours.

Authentication

Implement:

 Login

 Forgot Password

 Company Login

 Session Management

 Role-Based Access Control (RBAC)

Roles:

 AI Algo Super Admin

 Tenant Admin

 Regional Manager

 Outlet Manager

 Supervisor

 Viewer

Multi-Tenant Model

Each company must have:

 Company Profile

 Branding

 Multiple Outlets

 Multiple Cameras

 Multiple Users

 Independent Data

 Secure Row-Level Security

Never allow one tenant to see another tenant's data.

Initial Database Schema

Create production-ready schema for:

 companies

 outlets

 users

 roles

 cameras

 conversations

 transcripts

 summaries

 alerts

 keywords

 languages

 audit_logs

Include:

 UUID primary keys

 created_at

 updated_at

 created_by

 soft delete support

 indexing

 foreign keys

Navigation

Left sidebar:

Dashboard

ConversationIQ™

Alerts

Reports

AI Assistant

Outlets

Cameras

Users

Settings

Audit Logs

Profile

Dashboard (Foundation)

Create a modern executive dashboard with cards showing:

 Total Conversations

 Active Outlets

 Active Cameras

 Alerts Today

 Average Sentiment

 Languages Detected

Charts:

 Daily Conversations

 Sentiment Trend

 Top Keywords

Use realistic demo data.

Company Management

Support:

 Add Company

 Edit Company

 Company Logo

 Contact Details

 Subscription Plan

 Status

 Time Zone

 Preferred Languages

Outlet Management

Each outlet includes:

 Name

 Address

 Region

 Time Zone

 Manager

 Number of Cameras

 Operational Status

Camera Management

Store:

 Camera Name

 RTSP URL placeholder

 Location

 Status

 Audio Enabled

 Last Seen

 Assigned Outlet

Do not connect to cameras yet.

UI Quality

Use enterprise spacing.

Rounded cards.

Modern typography.

Subtle shadows.

Professional icons.

Loading skeletons.

Error states.

Empty states.

Dark mode optimized.

Demo Data

Generate realistic data for:

 1 company

 5 outlets

 32 cameras

 50 users

 1,000 conversation records

 Multiple languages

 Sample alerts

The application should look like a live production system.

Code Quality

Generate production-ready code.

No mock components that cannot be extended.

No shortcuts.

Keep the architecture clean and modular so future prompts can add AI capabilities without refactoring.

Success Criteria

At the end of this prompt, AegisIQ CX™ should feel like a premium enterprise SaaS platform that could be demonstrated to a Fortune 500 customer even before AI features are connected.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://aegisiq-cx.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35d0fc92-2ca0-4b69-b273-98865699a05d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

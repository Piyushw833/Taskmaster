# Oculis - Smart Real Estate Platform

Oculis is an AI-powered real estate platform that centralizes 3D property scans, documents, and analytics into one immersive, interactive dashboard. It helps streamline property evaluation, contract handling, and decision-making using 3D digital twins, GPT-based agents, and secure cloud collaboration.

## Features

- 3D Digital Twin Viewer
- AI-Powered Property Analysis
- Secure Document Management
- Interactive Property Dashboard
- Real-time Analytics
- Role-based Access Control

## Tech Stack

- **Frontend:**
  - React with TypeScript
  - Three.js for 3D visualization
  - Material-UI for components
  - React Query for data fetching
  - Zustand for state management

- **Backend:**
  - Node.js with Express
  - TypeScript
  - PostgreSQL with Prisma ORM
  - OpenAI API integration
  - JWT authentication

- **DevOps:**
  - Docker for containerization
  - ESLint and Prettier for code quality
  - GitHub Actions for CI/CD

## Getting Started

### Prerequisites

- Node.js 20.x or later
- Docker and Docker Compose
- Git

### Development Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd oculis
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Copy example env files
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   cp backend/.env.example backend/.env
   ```

4. Start the development environment:
   ```bash
   docker-compose up
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- PostgreSQL: localhost:5432

### Development Commands

- Start development servers:
  ```bash
  npm run dev
  ```

- Run linting:
  ```bash
  npm run lint
  ```

- Format code:
  ```bash
  npm run format
  ```

- Build for production:
  ```bash
  npm run build
  ```

## Project Structure

```
oculis/
├── frontend/               # React frontend application
│   ├── src/               # Source files
│   ├── public/            # Static files
│   └── vite.config.ts     # Vite configuration
├── backend/               # Express backend application
│   ├── src/              # Source files
│   ├── prisma/           # Database schema and migrations
│   └── tsconfig.json     # TypeScript configuration
├── docker-compose.yml    # Docker Compose configuration
└── package.json         # Root package.json for workspaces
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

This project is private and confidential. All rights reserved. 
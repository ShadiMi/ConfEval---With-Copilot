# ConfEval - Conference Review System

A full-stack web application for managing conference paper reviews, built with FastAPI (Python) and Next.js (TypeScript).

## Features

- User authentication (local + Google OAuth)
- Conference management
- Paper submission and review workflow
- Session scheduling
- Role-based access control (Admin, Reviewer, Author)
- File uploads (papers, slides, CVs)

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Infrastructure**: Docker, Nginx

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ConfEval
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** and set your values:
   ```env
   DB_PASSWORD=your-secure-password
   SECRET_KEY=your-secret-key
   ```
   
   Generate a secret key:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```

4. **Start the application**
   ```bash
   docker-compose up --build
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Development

For local development with hot-reload:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_PASSWORD` | PostgreSQL password | Yes |
| `SECRET_KEY` | JWT signing key | Yes |
| `DEBUG` | Enable debug mode | No (default: False) |
| `FRONTEND_URL` | Frontend URL for CORS | No |
| `NEXT_PUBLIC_API_URL` | API URL for frontend | No |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | No |

## Project Structure

```
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── routers/   # API endpoints
│   │   ├── models.py  # Database models
│   │   └── schemas.py # Pydantic schemas
│   └── main.py
├── frontend/          # Next.js frontend
│   └── src/
│       ├── app/       # Pages (App Router)
│       ├── components/
│       └── lib/       # Utilities
├── nginx/             # Nginx config (production)
└── docker-compose.yml
```

## License

MIT

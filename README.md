# SmartAttend — Phase 1

## 1. Database
Install PostgreSQL, then create the DB:
    psql -U postgres -c "CREATE DATABASE smartattend;"

## 2. Backend
    cd backend
    npm install
    cp .env.example .env      (Windows: copy .env.example .env)  -> edit DATABASE_URL and JWT_SECRET
    npm run migrate           (creates all tables)
    npm run dev               (API on http://localhost:5000)

## 3. Frontend (new terminal)
    cd frontend
    npm install
    npm run dev               (open http://localhost:5173)

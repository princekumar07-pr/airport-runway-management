# ARMS — Airport Runway Management System (OS + DBMS PBL Prototype)

A beginner-friendly local prototype with dashboard, flight CRUD, runway display, scheduling, activity logs, MySQL persistence, priority scheduling and mutex-protected allocation.

## Requirements
- Node.js LTS
- MySQL Server
- VS Code

## Setup
1. Start MySQL service.
2. In MySQL Command Line Client, run `SOURCE C:/path/to/arms-prototype/database.sql;` (replace with your real path). Alternatively, open `database.sql`, copy all, paste into MySQL prompt and press Enter.
3. In VS Code, open the `arms-prototype` folder.
4. Open Terminal → New Terminal, run `npm install`.
5. Copy `.env.example` to `.env`, then update DB_PASSWORD with your MySQL root password. If your MySQL password is blank, keep `DB_PASSWORD=`.
6. Start server: `npm start`.
7. Open `http://localhost:3000` in a browser.

## Demo flow
1. Dashboard shows seeded sample flights.
2. Add a new flight.
3. Flight Schedule: manually Allocate one flight.
4. Runway Management: click Run scheduler to allocate remaining flights using Emergency > High > Normal, then FCFS within priority.
5. System Logs: inspect event history.
6. Add two flights with close scheduled times and demonstrate the runway occupancy + 10 minute safety gap rule. This is a simplified simulation, not real aviation separation standards.

## Important
This is an educational prototype only. It must not be used for real airport or aviation operations.

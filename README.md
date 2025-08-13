Task Schedule Manager
Minimal .NET 8 API + React (Vite) + Tailwind UI to manage tasks with due dates, duration timers, local alarms, and (optional) email reminders.

Stack
API: ASP.NET Core Minimal APIs, EF Core (SQLite or InMemory)

WEB: React + TypeScript + Vite + TailwindCSS

Scheduler: BackgroundService that scans reminders every 60s

Email: IEmailSender stub by default (logs only). SMTP optional.

Prerequisites
.NET SDK 8 – https://dotnet.microsoft.com/download

Node.js LTS (≥ 18) & npm – https://nodejs.org

Git

Optional (Windows/macOS): trust the ASP.NET dev cert if you use HTTPS
dotnet dev-certs https --trust

Clone

    git clone https://github.com/NicolasAndrad3/tasks-manager.git
    cd tasks-manager
    
Run in development (one command)    
From the repo root:

    # install root tools (scripts) and web deps
     npm install
     npm --prefix web install

     # run API + Web together (concurrently)
      npm run dev
Web opens at: http://localhost:5173/

API launches on a local Kestrel port (e.g. http://localhost:5043).
The Vite dev server is already configured to proxy /api to the API during development—no extra env needed.

Prefer separate terminals?

     # terminal 1 (API)
      dotnet watch --project api run

      # terminal 2 (Web)
       cd web
       npm run dev
       
Configuration
1) Database (SQLite vs InMemory)
The API uses SQLite if a ConnectionStrings:Default is provided; otherwise it falls back to InMemory (volatile).

Create api/appsettings.json from api/appsettings.json.example:

    {
      "ConnectionStrings": {
    "Default": "Data Source=./todos.db"
     },
      "Email": {
    "Host": "",
    "Port": 587,
    "User": "",
    "Pass": "",
    "From": "",
    "EnableSsl": true
     }
    }
    
You can also set env vars instead of the file:

      ConnectionStrings__Default=Data Source=./todos.db
      
2) Email (optional)
By default the app registers NullEmailSender which just logs.
To send real emails, fill the Email settings above and add/enable a real SMTP implementation (e.g., Services/EmailSender.cs).
The scheduler will send emails when:

the model contains a destination address (e.g., NotifyEmail), and

a notify plan exists.

3) Frontend env
Dev: nothing required (Vite proxy takes care of /api).

Prod: set API origin.

web/.env.production:

    VITE_API=https://your-api.example.com
If you serve the Web from the same origin as the API, you can omit VITE_API and the app will default to window.location.origin.

Useful scripts
Root:

       npm run dev        # run API + Web together (dev)
       npm run test:api   # dotnet test
       
web/:

    npm run dev
    npm run build      # outputs web/dist
    npm run preview
    
api/:

    dotnet run
     dotnet watch run
      dotnet test
      
Production builds
Web only

      npm --prefix web run build
      # serve web/dist with Nginx/Apache/any static host
      
API only

      dotnet publish api -c Release -o publish
        # run the binary from api/publish
Deploy the two parts however you prefer. In production, the Web uses VITE_API to reach the API (or same-origin if you deploy together).

Docker
A docker-compose.yml is included:

       docker compose up -d --build
Set ConnectionStrings__Default and any email envs as needed.

Tests

     dotnet test
     
Troubleshooting
ECONNREFUSED from Vite proxy: Make sure the API is running first (watch output for Now listening on: http://localhost:xxxx). Running npm run dev at the repo root starts both for you.

Emails aren’t sent: The default is a stub. Provide real SMTP settings and a concrete IEmailSender implementation. Ensure your model/DTO includes the destination email (e.g., NotifyEmail).

SQLite: No server required—SQLite uses a local .db file.

CRLF/LF warnings on Windows: Safe to ignore or configure git config core.autocrlf true.

Project structure

    api/           # ASP.NET Core + EF Core
    web/           # React + Vite + Tailwind
    tests/         # API tests
    docker-compose.yml
    
License
MIT – see LICENSE.

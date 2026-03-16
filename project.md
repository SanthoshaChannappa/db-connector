# Project: Universal Data Explorer (Electron + React + TS)

## Tech Stack
- **Framework:** Electron with `electron-vite`
- **Frontend:** React, TypeScript, Tailwind CSS
- **State Management:** TanStack Query (for data fetching), Zustand (for UI state)
- **UI Components:** Shadcn/UI (Radix UI), Lucide React (Icons)
- **Database Drivers:** `pg` (Postgres), `mysql2` (MySQL), `tedious` (SQL Server), `mongodb` (MongoDB)
- **Local Store:** `better-sqlite3` (for the temporary "Dump" database)

## Architecture Guidelines
1. **IPC Communication:** All database credentials and queries MUST stay in the Main process. The Renderer process sends signals via `window.electron.ipcRenderer`.
2. **Theme:** Use Tailwind's `dark` class strategy.
3. **Grid Logic:** Use a "Dirty State" for filters. Only trigger IPC fetch when the "Apply" button is clicked.

## Folder Structure
- `src/main/db/`: Connection drivers and query builders.
- `src/main/store/`: Logic for the temporary local database.
- `src/renderer/src/components/sidebar/`: Connection tree and folders.
- `src/renderer/src/components/grid/`: The data table with sorting/filtering.
- `src/renderer/src/hooks/`: Custom hooks for IPC calls.

## Feature Roadmap & Prompt Tasks

### Task 1: Connection UI & Storage
Create a right-side sidebar with a folder hierarchy. Implement a Dialog to add a connection (Title, Type, Host, Port, User, Pass). Store these in `electron-store`.

### Task 2: IPC Bridge for Databases
Set up an IPC handler in `main/index.ts` that:
1. Receives connection strings.
2. Validates connection (Test Connection).
3. Fetches schema (Tables, Views, etc.).

### Task 3: The Relational Grid
Create a `DataGrid` component. 
- It must accept a `rows` array and `columns` metadata.
- If a column is a Foreign Key, render it as a blue hyperlink.
- On click, trigger a new tab with `SELECT * FROM target_table WHERE id = value`.
- Add a "Virtual Column" at the end titled "Referenced By" that lists tables linking to this record.

### Task 4: Export Engine
Implement a utility using `exceljs` and `jspdf` to take the current grid state (filtered/sorted) and export it to the user's Downloads folder.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionSidebar } from './components/sidebar/ConnectionSidebar'
import { DataGrid } from './components/grid/DataGrid'
import { useAppStore } from './store'
import { Table } from 'lucide-react'

const queryClient = new QueryClient()

function AppContent() {
  const { grids } = useAppStore()

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <ConnectionSidebar />
      
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
        {grids.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <Table className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <div className="text-muted-foreground text-sm">Select a connection and table from the sidebar.</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4 scroll-smooth">
            {grids.map((grid) => (
              <DataGrid key={grid.id} gridId={grid.id} />
            ))}
            <div className="h-20 shrink-0" /> {/* Spacer for bottom scroll padding */}
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App

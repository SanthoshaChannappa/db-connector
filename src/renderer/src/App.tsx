import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionSidebar } from './components/sidebar/ConnectionSidebar'
import { DataGrid } from './components/grid/DataGrid'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        {/* Sidebar */}
        <ConnectionSidebar />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full bg-card overflow-hidden">
          <DataGrid />
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App

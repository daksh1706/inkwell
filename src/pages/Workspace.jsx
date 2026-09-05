import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import NotesEditor from '@/components/NotesEditor';
import Canvas from '@/components/Canvas';
import WelcomeOverlay from '@/components/WelcomeOverlay';
import { useActivePage, actions } from '@/lib/store';

export default function Workspace() {
  const active = useActivePage();

  // Empty state — no notebooks at all
  if (!active) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4">
          <p className="font-display text-3xl font-bold tracking-tight">Nothing here yet.</p>
          <p className="text-muted-foreground text-sm">Create your first notebook to get started.</p>
          <button
            data-testid="empty-create-notebook"
            onClick={() => actions.addNotebook('My Notebook')}
            className="px-6 py-3 rounded-xl bg-primary text-white font-display font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Create a notebook
          </button>
        </div>
      </div>
    );
  }

  const { page } = active;
  const view = page.view || 'split';

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />

        <div className="flex-1 flex min-h-0 relative">
          {/* Notes-only view */}
          {view === 'notes' && (
            <div className="flex-1 min-w-0 overflow-auto scrollbar-thin">
              <NotesEditor page={page} fullWidth />
            </div>
          )}

          {/* Canvas-only view */}
          {view === 'canvas' && (
            <div className="flex-1 min-w-0 relative">
              <Canvas page={page} />
            </div>
          )}

          {/* Split view */}
          {view === 'split' && (
            <>
              <div className="w-[42%] min-w-[300px] max-w-[540px] border-r border-border overflow-auto scrollbar-thin">
                <NotesEditor page={page} />
              </div>
              <div className="flex-1 min-w-0 relative">
                <Canvas page={page} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* First-run welcome overlay */}
      <WelcomeOverlay />
    </div>
  );
}
import { WaitingRoom } from './pages/WaitingRoom'
import HostDashboard from './pages/HostDashboard';
import { useAuth } from './contexts/AuthContext'
import { AuthPage } from './pages/AuthPage'
import './App.css'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">🎮</div>
        <h1 className="text-2xl font-bold text-yellow-400">
          Puzzles
        </h1>
        <p className="text-gray-400 mt-2">Loading...</p>
      </div>
    </div>
  )
}

export default function App() {
  const { session, team, isHost, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  // Show the actual registration/login page
  if (!session || (!team && !isHost)) {
    return <AuthPage />
  }

  // Temporary placeholders for pages we haven't built yet
if (isHost) {
  return <HostDashboard />
}
 if (team) {
  return <WaitingRoom />
}

  return <AuthPage />
}

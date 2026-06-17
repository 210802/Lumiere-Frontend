import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Upload from './pages/Upload'
import Train from './pages/Train'
import Edit from './pages/Edit'
import Export from './pages/Export'
import { StyleLibraryPage } from './pages/StyleLibraryPage'

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0A0908' }}>
      <TopBar />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', paddingLeft: 52 }}>
        <Sidebar />
        <main style={{ height: '100%', overflow: 'hidden' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload"  element={<Upload />} />
            <Route path="/train"   element={<Train />} />
            <Route path="/edit"    element={<Edit />} />
            <Route path="/export"  element={<Export />} />
            <Route path="/library" element={<StyleLibraryPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import TerrainDashboard from './components/terrain-gen/TerrainDashboard.jsx'
import './style.css'

const App = () => {
  return (
    <BrowserRouter>
      <div>
        <nav>
          <Link to="/terrain" style={{ textDecoration: 'none' }}>Terrain Generator</Link>
        </nav>
        
        <Routes>
          <Route path="/terrain" element={<TerrainDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

const CityGameHome = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>City Game</h1>
      <p>Welcome to the City Game project!</p>
      <div>
        <Link to="/terrain">
          <button style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            Open Terrain Generator
          </button>
        </Link>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
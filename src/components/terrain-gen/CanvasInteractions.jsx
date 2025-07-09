import React, { useEffect, useRef, useState } from 'react';
import { useTerrain } from '../../context/terrain-gen/TerrainContext.jsx';

const CanvasInteractions = ({ canvasRef }) => {
  const { map } = useTerrain();
  const [hoverElements, setHoverElements] = useState([]);
  const [highlightedVertex, setHighlightedVertex] = useState(null);
  const [neighborHighlights, setNeighborHighlights] = useState([]);
  const infoWidgetRef = useRef(null);
  
  useEffect(() => {
    if (!map || !canvasRef.current) return;
    
    const delaunatorWrapper = map.voronoiGenerator?.delaunatorWrapper;
    if (!delaunatorWrapper?.voronoiCells) return;
    
    const canvas = canvasRef.current;
    const settings = map.voronoiGenerator.settings;
    const scaleX = canvas.width / settings.gridSize;
    const scaleZ = canvas.height / settings.gridSize;
    const hoverRadius = 5;
    
    // Create hover elements for cells
    const cellHovers = [];
    delaunatorWrapper.voronoiCells.forEach((cell, cellId) => {
      if (!cell.site) return;
      
      cellHovers.push({
        id: `cell-${cellId}`,
        type: 'cell',
        cellId,
        left: (cell.site.x * scaleX) - hoverRadius,
        top: (cell.site.z * scaleZ) - hoverRadius,
        width: hoverRadius * 2,
        height: hoverRadius * 2,
        site: cell.site
      });
    });
    
    // Create hover elements for vertices
    const vertexHovers = [];
    if (delaunatorWrapper.circumcenters) {
      delaunatorWrapper.circumcenters.forEach((vertex, vertexId) => {
        if (!vertex || !vertex.x || !vertex.z) return;
        
        vertexHovers.push({
          id: `vertex-${vertexId}`,
          type: 'vertex',
          vertexId,
          left: (vertex.x * scaleX) - 3,
          top: (vertex.z * scaleZ) - 3,
          width: 6,
          height: 6,
          position: vertex
        });
      });
    }
    
    setHoverElements([...cellHovers, ...vertexHovers]);
  }, [map, canvasRef]);
  
  const handleCellHover = (cellId) => {
    const delaunatorWrapper = map.voronoiGenerator?.delaunatorWrapper;
    if (!delaunatorWrapper) return;
    
    const cell = delaunatorWrapper.voronoiCells.get(cellId);
    if (!cell) return;
    
    // Show cell info widget
    const info = {
      type: 'Cell',
      id: cellId,
      site: `(${cell.site.x.toFixed(1)}, ${cell.site.z.toFixed(1)})`,
      vertices: cell.vertexIds?.length || 0,
      neighbors: cell.neighbors?.length || 0
    };
    
    showInfoWidget(info);
    
    // Highlight neighbors
    const neighborElements = [];
    if (cell.neighbors) {
      cell.neighbors.forEach(neighborId => {
        neighborElements.push(`cell-${neighborId}`);
      });
    }
    setNeighborHighlights(neighborElements);
  };
  
  const handleVertexHover = (vertexId) => {
    const delaunatorWrapper = map.voronoiGenerator?.delaunatorWrapper;
    if (!delaunatorWrapper) return;
    
    const vertex = delaunatorWrapper.circumcenters[vertexId];
    if (!vertex) return;
    
    // Show vertex info widget
    const connectedCells = delaunatorWrapper.voronoiCellVertexMap.get(vertexId) || [];
    const connectedVertices = delaunatorWrapper.voronoiVertexVertexMap.get(vertexId) || [];
    
    const info = {
      type: 'Vertex',
      id: vertexId,
      position: `(${vertex.x.toFixed(1)}, ${vertex.z.toFixed(1)})`,
      connectedCells: connectedCells.length,
      connectedVertices: connectedVertices.length
    };
    
    showInfoWidget(info);
    setHighlightedVertex(vertexId);
  };
  
  const showInfoWidget = (info) => {
    if (infoWidgetRef.current) {
      infoWidgetRef.current.innerHTML = `
        <h4>${info.type} ${info.id}</h4>
        ${Object.entries(info).map(([key, value]) => 
          key !== 'type' && key !== 'id' ? 
          `<div class="cell-info-line">${key}: ${value}</div>` : ''
        ).join('')}
      `;
      infoWidgetRef.current.style.display = 'block';
    }
  };
  
  const hideInfoWidget = () => {
    if (infoWidgetRef.current) {
      infoWidgetRef.current.style.display = 'none';
    }
    setNeighborHighlights([]);
    setHighlightedVertex(null);
  };
  
  return (
    <div className="canvas-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
      <div id="cellHoverElements">
        {hoverElements.map(element => (
          <div
            key={element.id}
            className={element.type === 'cell' ? 'voronoi-cell-hover' : 'voronoi-vertex-hover'}
            style={{
              position: 'absolute',
              left: `${element.left}px`,
              top: `${element.top}px`,
              width: `${element.width}px`,
              height: `${element.height}px`,
              borderRadius: '50%',
              pointerEvents: 'auto',
              ...(neighborHighlights.includes(element.id) ? { backgroundColor: 'rgba(255, 0, 0, 0.5)' } : {}),
              ...(element.vertexId === highlightedVertex ? { backgroundColor: 'rgba(255, 255, 0, 0.8)' } : {})
            }}
            onMouseEnter={() => {
              if (element.type === 'cell') {
                handleCellHover(element.cellId);
              } else {
                handleVertexHover(element.vertexId);
              }
            }}
            onMouseLeave={hideInfoWidget}
          />
        ))}
      </div>
      
      <div 
        ref={infoWidgetRef}
        className="cell-info-widget"
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default CanvasInteractions;
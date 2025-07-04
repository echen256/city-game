import { VoronoiGenerator } from './geometry/voronoi/VoronoiGenerator.js';
import { RiversGenerator } from './rivers/RiversGenerator.js';
import { TributariesGenerator } from './rivers/TributariesGenerator.js';
import { FeatureDrawer } from './drawer/FeatureDrawer.js';
import { GraphState } from './geometry/graph/GraphState.js';
import { GraphUtils } from './geometry/graph/GraphUtils.js';
import { Map } from './Map.js';

// State
let voronoiGenerator = null;
// let coastlineGenerator = null;
// let hillsGenerator = null;
// let lakesGenerator = null;
// let marshGenerator = null;
let riversGenerator = null;
let tributariesGenerator = null;
let featureDrawer = null;

// Global seeded random number generator
let seededRandom = null;
let graphState = null;
let highlightedPartitionElements = [];
let showTriangulation = true;
let showVoronoi = true;
let showSites = true;
let showVertices = true;
let showHeightGradient = true;
let showLakes = true;
let showMarshes = true;
let showRivers = true;
let selectedCellId = null; // Track which cell is selected
let highlightedNeighbors = new Set(); // Track highlighted neighbor cells
let selectedVertexIndex = null; // Track which vertex is selected
let highlightedVertices = new Set(); // Track highlighted connected vertices

let map = null;

// Utility functions
function log(message) {
    const logOutput = document.getElementById('logOutput');
    const timestamp = new Date().toLocaleTimeString();
    logOutput.innerHTML += `[${timestamp}] ${message}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
    console.log(message);
}

function updateStatus(message) {
    document.getElementById('statusText').textContent = message;
}

function updateStats() {
    if (!voronoiGenerator) {
        document.getElementById('sitesCount').textContent = '0';
        document.getElementById('cellsCount').textContent = '0';
        document.getElementById('trianglesCount').textContent = '0';
        document.getElementById('coastalCellsCount').textContent = '0';
        document.getElementById('hillCellsCount').textContent = '0';
        document.getElementById('maxHeight').textContent = '0';
        document.getElementById('lakeCellsCount').textContent = '0';
        document.getElementById('maxDepth').textContent = '0';
        document.getElementById('marshCellsCount').textContent = '0';
        document.getElementById('riversCount').textContent = '0';
        return;
    }

    const sites = voronoiGenerator.delaunatorWrapper.points ? voronoiGenerator.delaunatorWrapper.points.length : 0;
    const cells = voronoiGenerator.delaunatorWrapper.voronoiCells ? voronoiGenerator.delaunatorWrapper.voronoiCells.size : 0;
    const triangles = voronoiGenerator.delaunatorWrapper?.delaunay?.triangles?.length || 0;

    document.getElementById('sitesCount').textContent = sites;
    document.getElementById('cellsCount').textContent = cells;
    document.getElementById('trianglesCount').textContent = triangles;
}

function getSettings() {
    return {
        gridSize: 600,
        margin: 60,
        seed: parseInt(document.getElementById('seed').value),
        voronoi: {
            enabled: true,
            numSites: parseInt(document.getElementById('numSites').value),
            distribution: document.getElementById('distribution').value,
            poissonRadius: parseInt(document.getElementById('poissonRadius').value),
            seed: parseInt(document.getElementById('seed').value),
            graphics: {
               
            }
        },
        rivers: {
            showRivers: true,
            numRivers: parseInt(document.getElementById('riversCount').value), 
            graphics: {
               color: 'blue',
               width: 3
            }
        },
        tributaries: {
            showTributaries: true,
            numTributaries: 5,// parseInt(document.getElementById('tributariesCount').value),
            maxTributaryLength:  5,//parseInt(document.getElementById('tributaryLength').value),
            graphics: {
                color: '#00BFFF',
                width: 2
            }
        }
    };
}

function enableDependentButtons(enable) {
    const buttons = ['generateCoastBtn', 'clearCoastBtn', 'generateHillsBtn', 'clearHillsBtn', 'generateLakesBtn', 'clearLakesBtn', 'generateRiversBtn', 'generateTributariesBtn', 'clearRiversBtn', 'generateMarshesBtn', 'clearMarshesBtn', 'exportImageBtn', 'exportDataBtn'];
    buttons.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = !enable;
            console.log(`${enable ? 'Enabled' : 'Disabled'} button: ${id}`);
        } else {
            console.error(`Button not found: ${id}`);
        }
    });
}

function createCellHoverElements() {
    const hoverContainer = document.getElementById('cellHoverElements');
    const canvas = document.getElementById('canvas');

    // Clear existing hover elements
    hoverContainer.innerHTML = '';

    if (!map.voronoiGenerator.delaunatorWrapper.voronoiCells) {
        return;
    }

    const scaleX = canvas.width / map.voronoiGenerator.settings.gridSize;
    const scaleZ = canvas.height / map.voronoiGenerator.settings.gridSize;
    const hoverRadius = 5; // 10px radius as requested

    map.voronoiGenerator.delaunatorWrapper.voronoiCells.forEach((cell, cellId) => {
        if (!cell.site) return;

        const hoverElement = document.createElement('div');
        hoverElement.className = 'voronoi-cell-hover';
        hoverElement.style.left = `${(cell.site.x * scaleX) - hoverRadius}px`;
        hoverElement.style.top = `${((cell.site.z || cell.site.y || 0) * scaleZ) - hoverRadius}px`;
        hoverElement.style.width = `${hoverRadius * 2}px`;
        hoverElement.style.height = `${hoverRadius * 2}px`;

        // Add data attribute for identification
        hoverElement.dataset.cellId = cellId;

        // Add hover event listeners
        hoverElement.addEventListener('mouseenter', () => {
            showCellInfo(cellId, cell);
        });

        hoverElement.addEventListener('mouseleave', () => {
            hideCellInfo();
        });

        // Add click event listener for neighbor highlighting
        hoverElement.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedCellId === cellId) {
                // If clicking the same cell, clear highlights
                clearNeighborHighlights();
            } else {
                // Highlight neighbors of clicked cell
                highlightNeighbors(cellId, cell);
            }
        });

        hoverContainer.appendChild(hoverElement);
    });

    // Create vertex hover elements
    const triangulationData = map.voronoiGenerator.delaunatorWrapper;
    createVertexHoverElements(triangulationData);
}

function createVertexHoverElements(triangulationData) {
    const vertexContainer = document.getElementById('vertexHoverElements');
    const canvas = document.getElementById('canvas');

    // Clear existing vertex elements
    vertexContainer.innerHTML = '';

    if (!map.voronoiGenerator || !triangulationData) {
        return;
    }

    if (!triangulationData || !triangulationData.circumcenters) {
        return;
    }

    const scaleX = canvas.width / map.voronoiGenerator.settings.gridSize;
    const scaleZ = canvas.height / map.voronoiGenerator.settings.gridSize;
    const vertexRadius = 1; // 5px radius for vertices (10px diameter)

    triangulationData.circumcenters.forEach((circumcenter, vertexIndex) => {
        if (!circumcenter) return;

        const vertexElement = document.createElement('div');
        vertexElement.className = 'voronoi-vertex-hover';
        if(circumcenter.x < 0 || circumcenter.z < 0) return;
        if(circumcenter.x > map.voronoiGenerator.settings.gridSize || circumcenter.z > map.voronoiGenerator.settings.gridSize) return;  
        vertexElement.style.left = `${(circumcenter.x * scaleX) - vertexRadius}px`;
        vertexElement.style.top = `${(circumcenter.z * scaleZ) - vertexRadius}px`;
        vertexElement.style.width = `${vertexRadius * 2}px`;
        vertexElement.style.height = `${vertexRadius * 2}px`;

        // Add data attribute for identification
        vertexElement.dataset.vertexIndex = vertexIndex;

        // Add hover event listeners
        vertexElement.addEventListener('mouseenter', () => {
            showVertexInfo(vertexIndex, circumcenter);
        });

        vertexElement.addEventListener('mouseleave', () => {
            hideCellInfo();
        });

        // Add click event listener for connected vertex highlighting
        vertexElement.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedVertexIndex === vertexIndex) {
                // If clicking the same vertex, clear highlights
                clearVertexHighlights();
            } else {
                // Highlight connected vertices
                highlightConnectedVertices(vertexIndex, circumcenter);
            }
        });

        vertexContainer.appendChild(vertexElement);
    });
}

function showCellInfo(cellId, cell) {
    const widget = document.getElementById('cellInfoWidget');
    const cellIdSpan = document.getElementById('cellId');
    const cellPositionSpan = document.getElementById('cellPosition');
    const cellNeighborsSpan = document.getElementById('cellNeighbors');
    const infoTypeSpan = document.getElementById('infoType');
    const vertexInfoDiv = document.getElementById('vertexInfo');
    const boundaryTypeSpan = document.getElementById('boundaryType');

    // Update widget content
    cellIdSpan.textContent = cellId;


    const x = cell.site.x.toFixed(1);
    const y = (cell.site.z || cell.site.y || 0).toFixed(1);
    cellPositionSpan.textContent = `(${x}, ${y})`;

    // Get neighbors array
    const neighbors = cell.neighbors ? Array.from(cell.neighbors).sort((a, b) => a - b) : [];
    cellNeighborsSpan.textContent = `[${neighbors.join(', ')}]`;

    // Set type to Cell
    infoTypeSpan.textContent = 'Cell';
    vertexInfoDiv.style.display = 'none';
    boundaryTypeSpan.textContent = cell.boundaryType;
    // Show widget
    widget.style.display = 'block';
}

function showVertexInfo(vertexIndex, circumcenter) {
    const widget = document.getElementById('cellInfoWidget');
    const cellIdSpan = document.getElementById('cellId');
    const cellPositionSpan = document.getElementById('cellPosition');
    const cellNeighborsSpan = document.getElementById('cellNeighbors');
    const infoTypeSpan = document.getElementById('infoType');
    const vertexInfoDiv = document.getElementById('vertexInfo');
    const connectedCellsSpan = document.getElementById('connectedCells');

    // Update widget content for vertex
    cellIdSpan.textContent = `Vertex ${vertexIndex}`;

    const x = circumcenter.x.toFixed(1);
    const y = circumcenter.z.toFixed(1);    
    cellPositionSpan.textContent = `(${x}, ${y})`;

    // Find connected cells (cells that share this vertex)
    const connectedCells = [...map.voronoiGenerator.delaunatorWrapper.voronoiCellVertexMap[vertexIndex]];
    cellNeighborsSpan.textContent = `[${connectedCells.join(', ')}]`;

    // Set type to Vertex and show connected cells info
    infoTypeSpan.textContent = 'Vertex';
    const connectedVertices = [...map.voronoiGenerator.delaunatorWrapper.voronoiVertexVertexMap[vertexIndex]];
    connectedCellsSpan.textContent = `[${connectedVertices.join(', ')}]`;
    vertexInfoDiv.style.display = 'block';

    // Show widget
    widget.style.display = 'block';
}

function hideCellInfo() {
    const widget = document.getElementById('cellInfoWidget');
    widget.style.display = 'none';
}

function clearNeighborHighlights() {
    // Remove highlight class from all previously highlighted elements
    const hoverContainer = document.getElementById('cellHoverElements');
    const highlightedElements = hoverContainer.querySelectorAll('.neighbor-highlight');
    highlightedElements.forEach(element => {
        element.classList.remove('neighbor-highlight');
    });
    highlightedNeighbors.clear();
    selectedCellId = null;
}

function clearVertexHighlights() {
    // Remove highlight class from all previously highlighted vertex elements
    const vertexContainer = document.getElementById('vertexHoverElements');
    const highlightedElements = vertexContainer.querySelectorAll('.vertex-highlight');
    highlightedElements.forEach(element => {
        element.classList.remove('vertex-highlight');
    });
    highlightedVertices.clear();
    selectedVertexIndex = null;
}

function highlightNeighbors(cellId, cell) {
    // Clear previous highlights
    clearNeighborHighlights();
    clearVertexHighlights();

    // Set new selection
    selectedCellId = cellId;

    if (!cell.neighbors || cell.neighbors.length === 0) {
        return;
    }

    // Get hover container for finding neighbor elements
    const hoverContainer = document.getElementById('cellHoverElements');
    const hoverElements = hoverContainer.children;

    // Highlight each neighbor
    cell.neighbors.forEach(neighborId => {
        highlightedNeighbors.add(neighborId);

        // Find the corresponding hover element
        // Elements are created in the same order as cells.forEach()
        for (let i = 0; i < hoverElements.length; i++) {
            const element = hoverElements[i];
            if (element.dataset.cellId == neighborId) {
                element.classList.add('neighbor-highlight');
                break;
            }
        }
    });
}

function highlightConnectedVertices(vertexIndex, circumcenter) {
    // Clear previous highlights
    clearNeighborHighlights();
    clearVertexHighlights();

    // Set new selection
    selectedVertexIndex = vertexIndex;

    const connectedVertices = map.voronoiGenerator.delaunatorWrapper.voronoiVertexVertexMap[vertexIndex];

    // Get vertex container for finding vertex elements
    const vertexContainer = document.getElementById('vertexHoverElements');
    const vertexElements = vertexContainer.children;

    // Highlight each connected vertex
    connectedVertices.forEach(connectedVertexIndex => {
        highlightedVertices.add(connectedVertexIndex);

        // Find the corresponding vertex element
        for (let i = 0; i < vertexElements.length; i++) {
            const element = vertexElements[i];
            if (element.dataset.vertexIndex == connectedVertexIndex) {
                element.classList.add('vertex-highlight');
                break;
            }
        }
    });
}

// Vertex highlighting functionality
let highlightedVertexId = null;
let highlightedVertexElement = null;

function updateSettings() {
    map.drawDiagram(getSettings());
}

function highlightVertex(vertexId) {
    // Clear any existing highlight
    clearVertexHighlight();

    if (!map.voronoiGenerator || !map.voronoiGenerator.delaunatorWrapper) {
        log('Error: No Voronoi data available');
        return;
    }

    const circumcenters = map.voronoiGenerator.delaunatorWrapper.circumcenters;
    
    if (vertexId >= circumcenters.length || !circumcenters[vertexId]) {
        log(`Error: Vertex ${vertexId} not found or is null`);
        return;
    }

    const vertex = circumcenters[vertexId];
    const canvas = document.getElementById('canvas');
    const scaleX = canvas.width / map.voronoiGenerator.settings.gridSize;
    const scaleZ = canvas.height / map.voronoiGenerator.settings.gridSize;

    // Create highlight element
    const highlightElement = document.createElement('div');
    highlightElement.className = 'vertex-highlight';
    highlightElement.style.position = 'absolute';
    highlightElement.style.left = `${(vertex.x * scaleX) - 8}px`;
    highlightElement.style.top = `${((vertex.z || vertex.y || 0) * scaleZ) - 8}px`;
    highlightElement.style.width = '16px';
    highlightElement.style.height = '16px';
    highlightElement.style.backgroundColor = 'yellow';
    highlightElement.style.border = '2px solid red';
    highlightElement.style.borderRadius = '50%';
    highlightElement.style.pointerEvents = 'none';
    highlightElement.style.zIndex = '1000';
    highlightElement.style.boxShadow = '0 0 10px rgba(255, 255, 0, 0.8)';

    // Add to canvas container
    const canvasContainer = document.querySelector('.canvas-wrapper');
    canvasContainer.appendChild(highlightElement);

    highlightedVertexId = vertexId;
    highlightedVertexElement = highlightElement;

    log(`Highlighted vertex ${vertexId} at (${vertex.x.toFixed(1)}, ${(vertex.z || vertex.y || 0).toFixed(1)})`);
    updateStatus(`Vertex ${vertexId} highlighted`);
}

function clearVertexHighlight() {
    if (highlightedVertexElement) {
        highlightedVertexElement.remove();
        highlightedVertexElement = null;
        
        if (highlightedVertexId !== null) {
            log(`Cleared highlight for vertex ${highlightedVertexId}`);
            highlightedVertexId = null;
            updateStatus('Vertex highlight cleared');
        }
    }
}

function updateGraphPartitionsList() {
    const partitionsList = document.getElementById('graphPartitionsList');
    
    if (!graphState || graphState.getCurrentPartitions().length === 0) {
        partitionsList.innerHTML = '<p class="no-partitions">No graph partitions available. Generate Voronoi diagram first.</p>';
        return;
    }

    const partitions = graphState.getCurrentPartitions();
    const stats = graphState.getStatistics();
    
    // Clear existing content
    partitionsList.innerHTML = '';

    // Create and add summary
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'partition-summary';
    summaryDiv.innerHTML = `<small>Total: ${stats.totalPartitions} partitions, ${stats.totalVertices} vertices</small>`;
    partitionsList.appendChild(summaryDiv);

    partitions.forEach((partition, index) => {
        const isHighlighted = graphState.highlightedPartition?.id === partition.id;
        const centroid = partition.centroid;
        
        // Create partition item element
        const partitionItem = document.createElement('div');
        partitionItem.className = `partition-item ${isHighlighted ? 'highlighted' : ''}`;
        partitionItem.dataset.partitionId = partition.id;

        // Create partition info section
        const partitionInfo = document.createElement('div');
        partitionInfo.className = 'partition-info';

        const partitionTitle = document.createElement('div');
        partitionTitle.className = 'partition-title';
        partitionTitle.textContent = partition.description;

        const partitionDetails = document.createElement('div');
        partitionDetails.className = 'partition-details';
        partitionDetails.textContent = `ID: ${partition.id}`;

        const partitionStats = document.createElement('div');
        partitionStats.className = 'partition-stats';
        const statsText = `${partition.stats.validVertices} vertices, ${partition.stats.totalEdges} edges`;
        const centroidText = centroid ? ` | Centroid: (${centroid.x.toFixed(1)}, ${centroid.z.toFixed(1)})` : '';
        partitionStats.textContent = statsText + centroidText;

        partitionInfo.appendChild(partitionTitle);
        partitionInfo.appendChild(partitionDetails);
        partitionInfo.appendChild(partitionStats);

        // Create partition actions section
        const partitionActions = document.createElement('div');
        partitionActions.className = 'partition-actions';

        const highlightBtn = document.createElement('button');
        highlightBtn.className = 'partition-btn highlight-btn';
        highlightBtn.textContent = isHighlighted ? 'Clear' : 'Highlight';
        highlightBtn.addEventListener('click', () => highlightPartition(partition.id));

        const centroidBtn = document.createElement('button');
        centroidBtn.className = 'partition-btn centroid-btn';
        centroidBtn.textContent = 'Centroid';
        centroidBtn.addEventListener('click', () => showPartitionCentroid(partition.id));

        partitionActions.appendChild(highlightBtn);
        partitionActions.appendChild(centroidBtn);

        // Assemble the partition item
        partitionItem.appendChild(partitionInfo);
        partitionItem.appendChild(partitionActions);

        // Add to container
        partitionsList.appendChild(partitionItem);
    });
}

function highlightPartition(partitionId) {
    if (!graphState) return;
    
    if (graphState.highlightedPartition?.id === partitionId) {
        graphState.clearHighlight();
    } else {
        graphState.highlightPartition(partitionId);
    }
}

function showPartitionCentroid(partitionId) {
    if (!graphState) return;
    
    const partition = graphState.getPartition(partitionId);
    if (!partition) return;
    
    const centroid = GraphUtils.determineCentroid(partition.graph, 'geometric');
    if (centroid) {
        // Clear any existing vertex highlight first
        clearVertexHighlight();
        
        // Create centroid highlight
        const canvas = document.getElementById('canvas');
        const scaleX = canvas.width / map.voronoiGenerator.settings.gridSize;
        const scaleZ = canvas.height / map.voronoiGenerator.settings.gridSize;

        const highlightElement = document.createElement('div');
        highlightElement.className = 'centroid-highlight';
        highlightElement.style.position = 'absolute';
        highlightElement.style.left = `${(centroid.x * scaleX) - 10}px`;
        highlightElement.style.top = `${(centroid.z * scaleZ) - 10}px`;
        highlightElement.style.width = '20px';
        highlightElement.style.height = '20px';
        highlightElement.style.backgroundColor = 'orange';
        highlightElement.style.border = '2px solid red';
        highlightElement.style.borderRadius = '50%';
        highlightElement.style.pointerEvents = 'none';
        highlightElement.style.zIndex = '1001';
        highlightElement.style.boxShadow = '0 0 15px rgba(255, 165, 0, 0.8)';

        const canvasContainer = document.querySelector('.canvas-wrapper');
        canvasContainer.appendChild(highlightElement);

        // Remove after 3 seconds
        setTimeout(() => {
            highlightElement.remove();
        }, 3000);

        log(`Showing centroid for partition ${partitionId} at (${centroid.x.toFixed(2)}, ${centroid.z.toFixed(2)})`);
    }
}

function highlightGraphPartition(partition) {
    clearGraphPartitionHighlight();
    
    if (!partition || !map.voronoiGenerator) return;
    
    const canvas = document.getElementById('canvas');
    const scaleX = canvas.width / map.voronoiGenerator.settings.gridSize;
    const scaleZ = canvas.height / map.voronoiGenerator.settings.gridSize;
    const canvasContainer = document.querySelector('.canvas-wrapper');

    // Highlight all vertices in this partition
    partition.graph.circumcenters.forEach((vertex, index) => {
        if (!vertex) return;
        
        const highlightElement = document.createElement('div');
        highlightElement.className = 'partition-vertex-highlight';
        highlightElement.style.position = 'absolute';
        highlightElement.style.left = `${(vertex.x * scaleX) - 3}px`;
        highlightElement.style.top = `${(vertex.z * scaleZ) - 3}px`;
        highlightElement.style.width = '6px';
        highlightElement.style.height = '6px';
        highlightElement.style.backgroundColor = 'cyan';
        highlightElement.style.border = '1px solid white';
        highlightElement.style.borderRadius = '50%';
        highlightElement.style.pointerEvents = 'none';
        highlightElement.style.zIndex = '999';
        highlightElement.style.boxShadow = '0 0 3px rgba(0, 255, 255, 0.8)';

        canvasContainer.appendChild(highlightElement);
        highlightedPartitionElements.push(highlightElement);
    });

    log(`Highlighted partition ${partition.id} with ${highlightedPartitionElements.length} vertices`);
}

function clearGraphPartitionHighlight() {
    highlightedPartitionElements.forEach(element => {
        element.remove();
    });
    highlightedPartitionElements = [];
}

// Event handlers
function initializeEventHandlers() {
    document.getElementById('generateVoronoiBtn').addEventListener('click', function () {
        try {
            updateStatus('Generating Voronoi diagram...');
            log('Starting Voronoi generation');

            // Initialize FeatureDrawer with the canvas and grid size
            const canvas = document.getElementById('canvas');
            featureDrawer = new FeatureDrawer(canvas, getSettings()); 
            
            // Set up event listeners for FeatureDrawer events
            featureDrawer.on('draw', function(data) {
                console.log('FeatureDrawer draw event triggered', data);
                createCellHoverElements();
            });
            
            featureDrawer.on('rivers-drawn', function(data) {
                console.log('Rivers drawn event triggered', data);
                log(`Drew ${data.count} rivers`);
            });
            
            featureDrawer.on('tributaries-drawn', function(data) {
                console.log('Tributaries drawn event triggered', data);
                log(`Drew ${data.count} tributaries`);
            });

            map = new Map(featureDrawer, getSettings());
            map.generateVoronoi();
            
            // Enable debugging buttons
            document.getElementById('refreshGraphStateBtn').disabled = false;
            document.getElementById('clearGraphHighlightBtn').disabled = false;
            document.getElementById('showGraphStatsBtn').disabled = false; 
            enableDependentButtons(true);

            updateStatus('Voronoi diagram generated successfully');
            log(`Generated ${map.voronoiGenerator.delaunatorWrapper.points.length} sites and ${map.voronoiGenerator.delaunatorWrapper.voronoiCells.size} cells`);

        } catch (error) {
            updateStatus(`Error: ${error.message}`);
            log(`Error generating Voronoi: ${error.message}`);
            console.error(error);
        }
    });

    document.getElementById('generateRiversBtn').addEventListener('click', function () {
        try {
            map.generateRivers(); 
        } catch (error) {
            updateStatus(`Error: ${error.message}`);
            log(`Error generating rivers: ${error.message}`);
            console.error(error);
        }
    });
 
    document.getElementById('generateTributariesBtn').addEventListener('click', function () {
        try {
            map.generateTributaries(); 
        } catch (error) {
            updateStatus(`Error: ${error.message}`);
            log(`Error generating tributaries: ${error.message}`);
            console.error(error);
        }
    });

    document.getElementById('clearRiversBtn').addEventListener('click', function () {
 
    });

    document.getElementById('clearAllBtn').addEventListener('click', function () {
        map = null;
        // coastlineGenerator = null;
        // hillsGenerator = null;
        // lakesGenerator = null;
        // marshGenerator = null;
        riversGenerator = null;
        featureDrawer = null;
        
        // Reset graph state
        if (graphState) {
            graphState.reset();
        }
        
        // Disable debugging buttons
        document.getElementById('refreshGraphStateBtn').disabled = true;
        document.getElementById('clearGraphHighlightBtn').disabled = true;
        document.getElementById('showGraphStatsBtn').disabled = true;

        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Clear hover elements
        const hoverContainer = document.getElementById('cellHoverElements');
        hoverContainer.innerHTML = '';

        // Clear vertex hover elements
        const vertexContainer = document.getElementById('vertexHoverElements');
        vertexContainer.innerHTML = '';

        // Hide info widget
        hideCellInfo();

        // Clear vertex highlight
        clearVertexHighlight();

        // Reset selection state
        selectedCellId = null;
        selectedVertexIndex = null;
        highlightedNeighbors.clear();
        highlightedVertices.clear();

        updateStats();
        enableDependentButtons(false);
        updateStatus('All data cleared');
        log('Cleared all data');
    });

    document.getElementById('toggleTriangulationBtn').addEventListener('click', function () {
        showTriangulation = !showTriangulation;
        updateSettings();
        log(`Triangulation ${showTriangulation ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('toggleVoronoiBtn').addEventListener('click', function () {
        showVoronoi = !showVoronoi;
        updateSettings();
        log(`Voronoi edges ${showVoronoi ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('toggleSitesBtn').addEventListener('click', function () {
        showSites = !showSites;
        updateSettings();
        log(`Sites ${showSites ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('toggleVerticesBtn').addEventListener('click', function () {
        showVertices = !showVertices;
        updateSettings();
        log(`Vertices ${showVertices ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('toggleHeightBtn').addEventListener('click', function () {
        showHeightGradient = !showHeightGradient;
        updateSettings();
        log(`Height gradient ${showHeightGradient ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('toggleLakesBtn').addEventListener('click', function () {
        showLakes = !showLakes;
        updateSettings();
        log(`Lakes ${showLakes ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('toggleMarshesBtn').addEventListener('click', function () {
        showMarshes = !showMarshes;
        updateSettings();
        log(`Marshes ${showMarshes ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('toggleRiversBtn').addEventListener('click', function () {
        showRivers = !showRivers;
        updateSettings();
        log(`Rivers ${showRivers ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('exportImageBtn').addEventListener('click', function () {
        if (!featureDrawer) return;

        try {
            const canvas = document.getElementById('canvas');
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `terrain_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            log('Image exported successfully');
        } catch (error) {
            log(`Error exporting image: ${error.message}`);
        }
    });

    document.getElementById('exportDataBtn').addEventListener('click', function () {
        if (!map.voronoiGenerator || !map.voronoiGenerator.delaunatorWrapper) {
            log('Error: No Voronoi data available to export');
            return;
        }

        try {
            updateStatus('Exporting DelaunatorWrapper data...');

            const delaunatorWrapper = map.voronoiGenerator.delaunatorWrapper;

            // Prepare export data object
            const exportData = {
                metadata: {
                    exportTimestamp: new Date().toISOString(),
                    version: '1.0',
                    description: 'Voronoi Delaunator data export',
                    settings: map.voronoiGenerator.settings
                },
                points: delaunatorWrapper.points.map((point, index) => ({
                    index: index,
                    x: point.x,
                    z: point.z || point.y || 0,
                    isBoundary: point.isBoundary || false
                })),
                triangles: delaunatorWrapper.delaunay ? 
                    Array.from(delaunatorWrapper.delaunay.triangles) : [],
                edges: delaunatorWrapper.edges.map((edge, index) => ({
                    index: index,
                    id: edge.id,
                    pointA: { x: edge.a.x, z: edge.a.z || edge.a.y || 0 },
                    pointB: { x: edge.b.x, z: edge.b.z || edge.b.y || 0 },
                    length: edge.length ? edge.length() : null
                })),
                voronoiCells: Array.from(delaunatorWrapper.voronoiCells.entries()).map(([index, cell]) => ({
                    index: index,
                    site: {
                        x: cell.site.x,
                        z: cell.site.z || cell.site.y || 0,
                        index: cell.siteIndex
                    },
                    vertices: cell.vertices.map(vertex => ({
                        x: vertex.x,
                        z: vertex.z,
                        triangleIndex: vertex.triangleIndex
                    })),
                    neighbors: Array.from(cell.neighbors || [])
                })),
                delaunayCircumcenters: delaunatorWrapper.circumcenters ?
                    delaunatorWrapper.circumcenters.map((center, index) => ({
                        index: index,
                        x: center ? center.x : null,
                        z: center ? center.z : null
                    })) : [],
                voronoiAdjacentCells: {}, // Simplified - not used in streamlined version
                indexMapping: {
                    validCellIndices: delaunatorWrapper.validCellIndices ?
                        Array.from(delaunatorWrapper.validCellIndices) : null,
                    indexMapping: delaunatorWrapper.indexMapping ?
                        Object.fromEntries(delaunatorWrapper.indexMapping) : null
                },
                delaunayRawData: delaunatorWrapper.delaunay ? {
                    triangles: Array.from(delaunatorWrapper.delaunay.triangles),
                    halfedges: Array.from(delaunatorWrapper.delaunay.halfedges),
                    hull: Array.from(delaunatorWrapper.delaunay.hull)
                } : null
            };

            // Convert to JSON string
            const jsonString = JSON.stringify(exportData, null, 2);

            // Create and download file
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `voronoi_data_${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            updateStatus(`Data exported successfully (${Math.round(jsonString.length / 1024)} KB)`);
            log(`Exported DelaunatorWrapper data: ${exportData.points.length} points, ${exportData.triangles.length} triangles, ${exportData.voronoiCells.length} cells`);

        } catch (error) {
            updateStatus(`Error: ${error.message}`);
            log(`Error exporting data: ${error.message}`);
            console.error(error);
        }
    });

    // Add document click listener to clear highlights when clicking outside
    document.addEventListener('click', (e) => {
        // Only clear if not clicking on a hover element
        if (!e.target.classList.contains('voronoi-cell-hover') &&
            !e.target.classList.contains('voronoi-vertex-hover')) {
            clearNeighborHighlights();
            clearVertexHighlights();
        }
    });

    document.getElementById('highlightVertexBtn').addEventListener('click', function () {
        const vertexId = parseInt(document.getElementById('highlightVertexId').value);
        
        if (isNaN(vertexId) || vertexId < 0) {
            log('Error: Please enter a valid vertex ID (non-negative integer)');
            return;
        }

        highlightVertex(vertexId);
    });

    document.getElementById('clearHighlightBtn').addEventListener('click', function () {
        clearVertexHighlight();
    });

    // Allow Enter key in the input field
    document.getElementById('highlightVertexId').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            document.getElementById('highlightVertexBtn').click();
        }
    });

    // Graph debugging event listeners
    document.getElementById('refreshGraphStateBtn').addEventListener('click', function () {
        if (graphState) {
            updateGraphPartitionsList();
            log('Graph state refreshed');
        }
    });

    document.getElementById('clearGraphHighlightBtn').addEventListener('click', function () {
        if (graphState) {
            graphState.clearHighlight();
            log('Graph partition highlight cleared');
        }
    });

    document.getElementById('showGraphStatsBtn').addEventListener('click', function () {
        if (graphState) {
            const stats = graphState.getStatistics();
            const history = graphState.getOperationHistory();
            
            let message = `Graph Statistics:\n`;
            message += `- Total Partitions: ${stats.totalPartitions}\n`;
            message += `- Total Vertices: ${stats.totalVertices}\n`;
            message += `- Largest Partition: ${stats.largestPartition} vertices\n`;
            message += `- Smallest Partition: ${stats.smallestPartition} vertices\n`;
            message += `- Average Size: ${stats.averagePartitionSize.toFixed(1)} vertices\n`;
            message += `- Operations: ${stats.operationsCount}\n`;
            message += `\nRecent Operations:\n`;
            
            history.slice(-3).forEach(op => {
                message += `- ${op.type}: ${op.details.description}\n`;
            });
            
            alert(message);
            log('Displayed graph statistics');
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventHandlers();
    log('Dashboard initialized');
    updateStatus('Ready to generate terrain features');
}); 
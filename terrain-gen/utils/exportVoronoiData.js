export function buildVoronoiExport(delaunatorWrapper, options = {}) {
  if (!delaunatorWrapper) {
    throw new Error('buildVoronoiExport: delaunatorWrapper is required');
  }

  const {
    settings = {},
    description = 'Voronoi Delaunator data export',
    version = '1.0',
    exportTimestamp = new Date().toISOString(),
    riverPaths = [],
    coastlines = []
  } = options;

  const serializePoint = (point) => ({
    x: point?.x ?? null,
    z: point?.z ?? point?.y ?? null,
    isBoundary: point?.isBoundary ?? false
  });

  const points = (delaunatorWrapper.points || []).map((point, index) => ({
    index,
    x: point.x,
    z: point.z || point.y || 0,
    isBoundary: point.isBoundary || false
  }));

  const triangles = delaunatorWrapper.delaunay ?
    Array.from(delaunatorWrapper.delaunay.triangles) : [];

  const edges = delaunatorWrapper.voronoiEdges ?
    Array.from(delaunatorWrapper.voronoiEdges.entries()).map(([key, edge], index) => ({
      index,
      key,
      id: edge?.id ?? key,
      pointA: serializePoint(edge?.a),
      pointB: serializePoint(edge?.b),
      length: edge?.length ? edge.length() : null,
      weight: edge?.weight ?? null
    })) : [];

  const voronoiCells = delaunatorWrapper.voronoiCells ?
    Array.from(delaunatorWrapper.voronoiCells.entries()).map(([index, cell]) => ({
      index,
      site: {
        x: cell.site.x,
        z: cell.site.z || cell.site.y || 0,
        index: cell.siteIndex
      },
      vertices: cell.vertices.map(vertex => ({
        x: vertex.x,
        z: vertex.z
      })),
      neighbors: Array.from(cell.neighbors || [])
    })) : [];

  const delaunayCircumcenters = (delaunatorWrapper.circumcenters || []).map((center, index) => ({
    index,
    x: center ? center.x : null,
    z: center ? center.z : null
  }));

  const rivers = riverPaths.map((path, riverIndex) => {
    const vertexIndices = Array.isArray(path) ? path : Array.from(path || []);
    return {
      index: riverIndex,
      vertexIndices,
      vertices: vertexIndices.map((vertexIndex) => {
        const vertex = delaunatorWrapper.circumcenters?.[vertexIndex];
        return {
          index: vertexIndex,
          x: vertex?.x ?? null,
          z: vertex?.z ?? vertex?.y ?? null
        };
      })
    };
  });

  const exportedCoastlines = coastlines.map((coastline, index) => ({
    index,
    id: coastline.id ?? `coastline_${index + 1}`,
    direction: coastline.direction ?? null,
    cells: Array.from(coastline.cells || [])
  }));

  const indexMapping = {
    validCellIndices: delaunatorWrapper.validCellIndices ?
      Array.from(delaunatorWrapper.validCellIndices) : null,
    indexMapping: delaunatorWrapper.indexMapping ?
      Object.fromEntries(delaunatorWrapper.indexMapping) : null
  };

  const delaunayRawData = delaunatorWrapper.delaunay ? {
    triangles: Array.from(delaunatorWrapper.delaunay.triangles),
    halfedges: Array.from(delaunatorWrapper.delaunay.halfedges),
    hull: Array.from(delaunatorWrapper.delaunay.hull)
  } : null;

  return {
    metadata: {
      exportTimestamp,
      version,
      description,
      settings
    },
    points,
    triangles,
    edges,
    voronoiCells,
    delaunayCircumcenters,
    rivers,
    coastlines: exportedCoastlines,
    voronoiAdjacentCells: {},
    indexMapping,
    delaunayRawData
  };
}

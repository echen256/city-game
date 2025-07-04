import { VoronoiGenerator } from './geometry/voronoi/VoronoiGenerator.js';
import { RiversGenerator } from './rivers/RiversGenerator.js';
import { TributariesGenerator } from './rivers/TributariesGenerator.js';
import { FeatureDrawer } from './drawer/FeatureDrawer.js';
import { GraphState } from './geometry/graph/GraphState.js';
import { GraphUtils } from './geometry/graph/GraphUtils.js';

export class Map {
    constructor(settings) {
        this.settings = settings;   
        this.graphState = new GraphState();
        this.voronoiGenerator = new VoronoiGenerator(this.graphState,this.settings);
        this.graphState.settings = this.voronoiGenerator.settings; 
        this.riversGenerator = new RiversGenerator(this.voronoiGenerator, this.settings);

        // Create global seeded random number generator
        this.seededRandom = new Math.seedrandom(settings.voronoi.seed);
        
        this.voronoiGenerator.setSeededRandom(this.seededRandom);
        this.riversGenerator = new RiversGenerator(this.voronoiGenerator, this.settings);
        this.riversGenerator.setSeededRandom(this.seededRandom);
        this.tributariesGenerator = new TributariesGenerator(this.voronoiGenerator, this.settings);
        this.tributariesGenerator.setSeededRandom(this.seededRandom);
    }

    generateMap() {
        this.voronoiGenerator.generateVoronoi();
        this.riversGenerator.generateRivers();
        this.tributariesGenerator.generateTributaries();
    }

    generateVoronoi() {
        this.voronoiGenerator.generateVoronoi();
    }

    generateRivers() {
        this.riversGenerator.generateRivers(this,this.graphState,this.settings.rivers.numRivers);
    }

    generateTributaries() {
        this.tributariesGenerator.generateTributaries(this);
    }
}
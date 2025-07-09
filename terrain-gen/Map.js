import { VoronoiGenerator } from './geometry/voronoi/VoronoiGenerator.js';
import { RiversGenerator } from './rivers/RiversGenerator.js';
import { TributariesGenerator } from './rivers/TributariesGenerator.js';
import { FeatureDrawer } from './drawer/FeatureDrawer.js';
import { GraphState } from './geometry/graph/GraphState.js';
import { GraphUtils } from './geometry/graph/GraphUtils.js';
import seedrandom from "seedrandom";

export class Map {
    constructor(featureDrawer, settings) {
        this.featureDrawer = featureDrawer;
        this.settings = settings;   
        this.graphState = new GraphState();
        this.seededRandom = seedrandom(this.settings.seed);
        this.voronoiGenerator = new VoronoiGenerator(this.graphState, this.settings, this.seededRandom);
        this.graphState.settings = this.voronoiGenerator.settings; 
        this.riversGenerator = new RiversGenerator(this.voronoiGenerator, this.settings, this.seededRandom);  
        this.tributariesGenerator = new TributariesGenerator(this.voronoiGenerator, this.settings, this.seededRandom);
    }

    updateSettings(settings) {
        if (settings) {
            this.featureDrawer.settings = settings;
        }
        this.voronoiGenerator.settings = settings;
        this.riversGenerator.settings = settings;
        this.tributariesGenerator.settings = settings; 
    }

    generateMap(settings) {
        if (settings) {
            this.updateSettings(settings);
        }
        this.voronoiGenerator.generateVoronoi();
        this.riversGenerator.generateRivers();
        this.tributariesGenerator.generateTributaries();
    }

    generateVoronoi() {
        this.voronoiGenerator.generateVoronoi(this);
        this.drawDiagram();
    }

    generateRivers() {
        this.riversGenerator.generateRivers(this);
        this.drawDiagram();
    }

    generateTributaries() {
        this.tributariesGenerator.generateTributaries(this);
        this.drawDiagram();
    }

    drawDiagram() {
        this.featureDrawer.drawDiagram(this);
    }
}
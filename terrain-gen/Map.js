import { VoronoiGenerator } from './geometry/voronoi/VoronoiGenerator.js';
import { RiversGenerator } from './rivers/RiversGenerator.js';
import { TributariesGenerator } from './rivers/TributariesGenerator.js';
import { LakesGenerator } from './lakes/LakesGenerator.js';
import { CoastlineGenerator } from './coastlines/CoastlineGenerator.js';
import { FeatureDrawer } from './drawer/FeatureDrawer.js';
import { GraphState } from './geometry/graph/GraphState.js';
import { GraphUtils } from './geometry/graph/GraphUtils.js';

export class Map {
    constructor(featureDrawer,settings) {
        this.featureDrawer = featureDrawer;
        this.settings = settings;   
        this.graphState = new GraphState();
        this.seededRandom = new Math.seedrandom(this.settings.seed);
        this.voronoiGenerator = new VoronoiGenerator(this.graphState,this.settings,this.seededRandom);
        this.graphState.settings = this.voronoiGenerator.settings; 
        this.riversGenerator = new RiversGenerator(this.voronoiGenerator, this.settings,this.seededRandom);  
        this.tributariesGenerator = new TributariesGenerator(this.voronoiGenerator, this.settings,this.seededRandom);
        this.lakesGenerator = new LakesGenerator(this.voronoiGenerator, this.settings, this.seededRandom);
        this.coastlineGenerator = new CoastlineGenerator(this.voronoiGenerator, this.settings, this.seededRandom);
       
    }

    updateSettings(settings) {
        if (settings) {
            this.featureDrawer.settings = settings;
        }
        this.voronoiGenerator.settings = settings;
        this.riversGenerator.settings = settings;
        this.tributariesGenerator.settings = settings; 
        if (this.lakesGenerator) {
            this.lakesGenerator.settings = settings;
            this.lakesGenerator.voronoiGenerator = this.voronoiGenerator;
            this.lakesGenerator.setSeededRandom(this.seededRandom);
        }
        if (this.coastlineGenerator) {
            this.coastlineGenerator.settings = settings;
            this.coastlineGenerator.voronoiGenerator = this.voronoiGenerator;
            this.coastlineGenerator.setSeededRandom(this.seededRandom);
        }
    }

    generateMap(settings) {
        if (settings) {
            this.updateSettings(settings);
        }
        this.voronoiGenerator.generateVoronoi();
        this.riversGenerator.generateRivers();
        this.tributariesGenerator.generateTributaries();
        this.lakesGenerator.generateLakes(this);
        this.coastlineGenerator.generateCoastlines(this);
    }

    generateVoronoi() {
        this.voronoiGenerator.generateVoronoi(this);
        this.drawDiagram();
    }

    generateRivers() {
        this.riversGenerator.generateRivers(this);
        this.drawDiagram();
    }

    generateCoastlines() {
        if (!this.coastlineGenerator) {
            throw new Error('Coastline generator is not initialized');
        }
        this.coastlineGenerator.generateCoastlines(this);
        this.drawDiagram();
    }

    clearCoastlines() {
        if (this.coastlineGenerator) {
            this.coastlineGenerator.clearCoastlines();
            this.drawDiagram();
        }
    }

    generateLakes() {
        if (!this.lakesGenerator) {
            throw new Error('Lakes generator is not initialized');
        }
        this.lakesGenerator.generateLakes(this);
        this.drawDiagram();
    }

    clearLakes() {
        if (this.lakesGenerator) {
            this.lakesGenerator.clearLakes();
            this.drawDiagram();
        }
    }

    generateTributaries() {
        this.tributariesGenerator.generateTributaries(this);
        this.drawDiagram();
    }

    drawDiagram() {
        this.featureDrawer.drawDiagram(this);
    }
}

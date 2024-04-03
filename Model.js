import {read_JSON} from './ModelsManager.js';

export class Model {
    // Properties
    nerveModel
    placement
    stimset

    // Data model, no graphics here
    constructor(nerveModel, placement, stimset) {
        this.nerveModel = nerveModel;
        this.placement = placement;
        this.stimset = stimset;
    }

    async init() {
        // Must be called manually after constructor
        this.stimsetParams = (await read_JSON(this.stimsetFolder + 'params.json')).simulations;
        this.stimulations = Object.keys(this.stimsetParams);
        this.fibersets = this.stimsetParams[this.stimulations[0]].setup.fiberSets;
    }

    get fullName() { return this.nerveModel + '_' + this.placement + '_' + this.stimset }
    get modelFolder() { return 'data/Models/' + this.nerveModel + '/' }
    get placementFolder() { return this.modelFolder + 'Placements/' + this.placement + '/' }
    get stimsetFolder() { return this.placementFolder + 'StimSets/' + this.stimset + '/' }
    
    stimulationFolder(stimulation) { return this.stimsetFolder + 'Simulations/' + stimulation + '/' }
    async stimulationParams(stimulation) { return await read_JSON(this.stimulationFolder(stimulation) + 'simParams.json') };

    fibers_path(fiberset) { return this.placementFolder + 'FiberSets/' + fiberset + '/fibers.bin' }
    threshold_path(stimulation, fiberset) { return this.stimulationFolder(stimulation) + 'Recruitments/' + fiberset + '.bin' }
}
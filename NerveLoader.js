import * as THREE from './_snowpack/pkg/three.js';
import { STLLoader } from './_snowpack/pkg/three/examples/jsm/loaders/STLLoader.js';
import ndarray from './_snowpack/pkg/ndarray.js';
import colormap from './_snowpack/pkg/colormap.js';

import { create, all, matrix } from './_snowpack/pkg/mathjs.js'

const config = {}
const math = create(all, config)

export class NerveLoader {
    #model
    #viewOptions
    modelOptions

    // Events
    onEpiLoaded
    onThresholdsLoaded
    onAsLoaded

    materialFibers = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true });  // transparent is needed for correct depth calculation

    // MeshLambertMaterial works well and is faster than Standard

    renderOrderFibers = 0;
    renderOrderAS = 1;
    renderOrderFasc = 1;
    renderOrderElec = 2;
    renderOrderEpi = 3;

    fiberSetColors

    constructor(scene, onEpiLoaded, onThresholdsLoaded, onAsLoaded) {
        this.scene = scene;
        this.onEpiLoaded = onEpiLoaded.bind(this);
        this.onThresholdsLoaded = onThresholdsLoaded.bind(this);
        this.onAsLoaded = onAsLoaded.bind(this);

        this.loader = new STLLoader();
    }

    get model() {
        return this.#model;
    }

    set model(model) {
        //const old_model = this.model;
        this.#model = model;
    }

    get viewOptions() {
        return this.#viewOptions;
    }

    set viewOptions(model) {
        //const old_model = this.viewOptions;
        this.#viewOptions = model;
    }

    async load_fascicles() {
        const materialEndo = new THREE.MeshLambertMaterial({
            color: this.viewOptions.fascColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: this.viewOptions.fascAlpha,
            visible: this.viewOptions.fascAlpha > 0.05
        });
        this.load_stl_list('Fascicle', this.model.modelFolder + 'Fascicles/', 'endoneuria.txt', materialEndo, this.renderOrderFasc);
    }

    async load_electrodes() {
        const materialElec = new THREE.MeshLambertMaterial({
            color: this.viewOptions.elecColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: this.viewOptions.elecAlpha,
            visible: this.viewOptions.elecAlpha > 0.05,
            polygonOffset: true, polygonOffsetFactor: 1  // to avoid overlap with AS
        });
        this.load_stl_list('Electrode', this.model.placementFolder + "Electrodes/", 'electrodes.txt', materialElec, this.renderOrderElec);
    }

    async load_fibers() {
        console.log('Loading fibers.');
        // Import Fibers
        this.model.fibersets.forEach(
            fiberset => load_ndarray(this.model.fibers_path(fiberset), ((fiberCenters) => this.read_fibers(fiberCenters, fiberset)).bind(this))
        );
    }

    read_fibers(fiberCenters, fiberset) {
        const nFibers = fiberCenters.shape[0];
        // const nPointsPerFibers = fiberCenters.shape[1];
        const nDisplayedFibers = Math.round(nFibers / this.viewOptions.plotRatio);
        const step = Math.round(this.viewOptions.plotRatio);
        const lines = new Array(nDisplayedFibers);
        const iFiberSet = this.model.fibersets.indexOf(fiberset);
        const color = this.fiberSetColors[iFiberSet];
        const material = this.materialFibers.clone();
        material.color.set(color);
        let c = 0;
        for (let iFiber = 0; iFiber < nFibers; iFiber += step) {
            //const points = fiberCenters.hi(iFiber, 0, 0).transpose(1, 0); // may need a transpose
            const points = fiberCenters.pick(iFiber, null, null);
            const flattened = new Float32Array(points.size);
            for (let i = 0; i < points.shape[0]; i++) {
                for (let j = 0; j < points.shape[1]; j++) {
                    flattened[i * points.shape[1] + j] = points.get(i, j) * 1e-3;
                }
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(flattened, 3));
            lines[c] = new THREE.Line(geometry, material);
            lines[c].name = 'Fiber';
            lines[c].renderOrder = -1;
            lines[c].visible = this.viewOptions.showFibers;
            this.scene.add(lines[c]);
            c++;
        }
        console.log(nDisplayedFibers);
        console.log(c + ' fibers loaded.');
    }

    import_thresholds(fiberset) {
        function read_thresholds(thresholds) {
            this.onThresholdsLoaded(thresholds, fiberset);
            return;
            // COLOR NOW ASSIGNED BY FIBER TYPE
            const minThreshold = Math.log(Math.min.apply(null, thresholds.filter(x => x > 0)));
            const maxThreshold = Math.log(Math.max.apply(null, thresholds));
            const cMin = new THREE.Color(0xff0000);	// red
            const cMax = new THREE.Color(0x0000ff); // blue
            const thresh_to_color = function (line, thresh) {
                if (thresh > 0)  // otherwise leave black
                {
                    line.material.color.lerpColors(cMin, cMax, (Math.log(thresh) - minThreshold) / (maxThreshold - minThreshold));
                }
            }
            for (let i = 0; i < lines.length; i++) {
                const threshInd = i * this.viewOptions.plotRatio;
                thresh_to_color(lines[i], thresholds[threshInd]);
            }
            console.log('Thresholds loaded.');
        }

        load_bin(this.model.threshold_path(this.modelOptions.stimulation, fiberset), read_thresholds.bind(this));
    }

    load_thresholds() {
        // TODO reimplement fiber color by threshold
        const thresholds = this.model.fibersets.map(
            fiberset => load_ndarray_async(this.model.threshold_path(this.modelOptions.stimulation, fiberset))
        );
        console.log('Test');
        Promise.all(thresholds).then((values) => this.onThresholdsLoaded(this.model.fibersets, this.fiberSetColors, values));
    }

    async load_nerve() {
        // Import Epineurium
        const materialEpi = new THREE.MeshLambertMaterial({
            color: this.viewOptions.epiColor,
            side: THREE.DoubleSide,
            transparent: true, opacity: this.viewOptions.epiAlpha, visible: this.viewOptions.epiAlpha > 0.05,
            //depthTest: false, depthWrite: false,
            depthWrite: false,
            polygonOffset: true, polygonOffsetFactor: 1  // To avoid overlapping faces with fascicles
        });
        this.load_stl('Epineurium', this.model.modelFolder + 'Epineurium/epineurium.stl', materialEpi.clone(), this.renderOrderEpi, this.onEpiLoaded);

        this.fiberSetColors = colormap({
            colormap: 'hsv',  // hsv requires at least 11 nshades, rainbow 9, rainbow-soft 11
            nshades: this.model.fibersets.length*11,  // e.g., for rainbow: math.max(this.model.fibersets.length, 9)
            format: 'hex',
            alpha: 1
        })
        console.log(this.fiberSetColors);
        
        this.fiberSetColors = math.range(0, this.fiberSetColors.length, 11).toArray().map(i => this.fiberSetColors[i]);
        console.log(this.fiberSetColors);

        this.load_fascicles();
        this.load_electrodes();
        this.load_fibers();
        this.load_thresholds();

        const stimParams = await this.model.stimulationParams(this.modelOptions.stimulation);
        console.log(stimParams);
        const currAS = stimParams.namesAS;

        // Import AS
        const asColor = "#0000FF"
        //const materialAS = new THREE.MeshLambertMaterial({ color: asColor, emissive: asColor, side: THREE.DoubleSide, transparent: true /*, depthTest: false, depthWrite: true*/ });
        //const materialCurrAS = new THREE.MeshLambertMaterial({ color: 0xFFFF00, emissive: 0xFFFF00, side: THREE.DoubleSide, transparent: true/*, depthTest: false, depthWrite: true*/ });
        const materialAS = new THREE.MeshLambertMaterial({ color: asColor, emissive: asColor, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: true });
        const materialCurrAS = new THREE.MeshLambertMaterial({ color: 0xFFFF00, emissive: 0xFFFF00, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: true });
        this.load_stl_list('AS', this.model.placementFolder + "Electrodes/", 'AS.txt', materialAS, this.renderOrderAS, null, [currAS + '.stl']);
        this.load_stl('AS', this.model.placementFolder + "Electrodes/" + currAS + '.stl', materialCurrAS, this.renderOrderAS);
        // TODO reimplement AS
        // for (let iAS = 1; iAS <= this.model.nAS; iAS++) {
        //     if (iAS == this.model.iAS)
        //         this.load_stl('AS', this.model.placementFolder + "Electrodes/AS" + iAS + ".stl", materialCurrAS.clone(), this.renderOrderAS, this.onAsLoaded);
        //     else
        //         this.load_stl('AS', this.model.placementFolder + "Electrodes/AS" + iAS + ".stl", materialAS.clone(), this.renderOrderAS);
        //     //mesh.onBeforeRender = function (renderer) { renderer.clearDepth(); };
        // }
    }

    load_fascIdsByAs(stimsetFolder, func) {
        load_ndarray(stimsetFolder + 'fascIdsByAs.dat', func, Uint8Array);
    }

    // Using arrow functions removes the need to bind because it does not override 'this'
    load_stl = (name, fname, material, renderOrder, callback) => {
        console.log('Loading ' + fname);
        this.loader.load(
            fname,
            (geometry) => {
                const mesh = new THREE.Mesh(geometry, material)
                mesh.name = name;
                mesh.renderOrder = renderOrder;
                this.scene.add(mesh)
                if (callback != null) {
                    callback(mesh);
                }
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
            },
            (error) => {
                console.log(error)
            }
        )
    }

    async load_stl_list(name, folder, list_name, material, renderOrder, callback, skipList) {
        if (callback != null) {
            callback = callback.bind(this);
        }
        const func = function (fname) { this.load_stl(name, folder + fname, material.clone(), renderOrder, callback) }
        foreach_line(folder + list_name, func.bind(this), skipList);
    }
}

function load_ndarray(path, func, type) {
    // 1:1 read equivalent of web_export.write_binary in MATLAB
    function func2(array) {
        const nd = array[0];
        const shape = array.slice(1, 1 + nd);
        array = ndarray(array.slice(1 + nd), shape);
        return func(array);
    }
    load_bin(path, func2, type);
}

function load_ndarray_async(path, type) {
    return new Promise((resolve, reject) => {
        load_ndarray(path, (successResponse) => { resolve(successResponse); }, type)
    });
}

function load_matrix(path, func, type) {
    // 1:1 read equivalent of web_export.write_binary in MATLAB
    function func2(array) {
        const nd = array[0];
        const shape = array.slice(1, 1 + nd);
        console.log(shape);
        //array = ndarray(array.slice(1 + nd), shape);
        let matrix = math.zeros(Array.from(shape));
        console.log(matrix);
        console.log(math.size(matrix));
        console.log(math.range(0, shape[0]));
        console.log(math.index(math.range(0, shape[0]), math.range(0, shape[1]), math.range(0, shape[2])));
        console.log(math.subset(matrix, math.index(math.range(0, shape[0]), math.range(0, shape[1]), math.range(0, shape[2]))));
        console.log(array.slice(1 + nd));
        // NOT WORKING YET
        matrix = math.subset(matrix, math.index(math.range(0, shape[0]), math.range(0, shape[1]), math.range(0, shape[2])), array.slice(1 + nd));
        return func(matrix);
    }
    load_bin(path, func2, type);
}

function load_bin(path, func, type) {
    if (type == null) {
        type = Float32Array;
    }
    var oReq = new XMLHttpRequest();
    oReq.open("GET", path, true);
    oReq.responseType = "arraybuffer";
    oReq.onload = function (_oEvent) {
        const arrayBuffer = oReq.response; // Note: not oReq.responseText
        if (arrayBuffer) {
            const array = new type(arrayBuffer);
            func(array);
        } else console.log('Download failed.');
    };
    oReq.send(null);
}

function load_bin_async(path, type) {
    return new Promise((resolve, reject) => {
        load_bin(path, (successResponse) => { resolve(successResponse); }, type)
    });
}

async function foreach_line(textFile, func, skipList) {
    const response = await fetch(textFile);
    const text_data = await response.text();
    let filenames = text_data.split(/\r?\n/).filter(e => e);  // Split lines and remove empty ones
    if (skipList != null) {
        filenames = filenames.filter(x => !skipList.includes(x));
    }
    filenames.forEach(func);
}

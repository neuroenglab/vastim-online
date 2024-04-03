import * as THREE from './_snowpack/pkg/three.js';
//import Stats from './node_modules/three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from './_snowpack/pkg/three/examples/jsm/controls/OrbitControls.js';
import * as dat from './_snowpack/pkg/dat.gui.js';
import { NerveLoader } from './NerveLoader.js';
import { plot_recruitment } from './plots.js';
import { models_list } from './ModelsManager.js';
import { Model } from './Model.js';

const scene = new THREE.Scene();
const nerve_loader = new NerveLoader(scene, onEpiLoaded, onThresholdsLoaded, onAsLoaded);

const modelsList = await models_list();
const nerveModels = modelsList.map(x => x.Model);

const model = new Model(nerveModels[0], modelsList[0].Placement, modelsList[0].StimSet);
model.init();

const modelOptions = {stimulation: null};

let sceneLoaded = false;
let centerCamera = true;
let lastStimulation = model.stimulation;
const asCenter = new THREE.Vector3();
const epiCenter = new THREE.Vector3();

// GUI setup
const gui = new dat.GUI();
const guiSelection = gui.addFolder('Model Selection');
guiSelection.add(model, 'nerveModel', nerveModels).name('Model').onFinishChange(update_placements);
let placementSelection, stimsetSelection, stimSelection;

function update_placements() {
    if (placementSelection != null) {
        placementSelection.remove();
    }
    const placements = modelsList.filter(x => x.Model == model.nerveModel).map(x => x.Placement);
    model.placement = placements[0];
    placementSelection = guiSelection.add(model, 'placement', placements).name('Placement').onFinishChange(update_stimsets);
    centerCamera = true;
    update_stimsets();
}

function update_stimsets() {
    if (stimsetSelection != null) { stimsetSelection.remove(); }
    const stimsets = modelsList.filter(x => x.Model == model.nerveModel && x.Placement == model.placement).map(x => x.StimSet);
    model.stimset = stimsets[0];
    stimsetSelection = guiSelection.add(model, 'stimset', stimsets).name('Stimset').onFinishChange(onStimSetChange);
    onStimSetChange();
}

async function onStimSetChange() {
    await model.init();
    console.log('Loaded');
    update_stimulation();
}

function update_stimulation() {
    if (stimSelection != null) { stimSelection.remove(); }
    modelOptions.stimulation = model.stimulations[0];
    stimSelection = guiSelection.add(modelOptions, 'stimulation', model.stimulations).name('Stimulation').onFinishChange(onStimChange)
    onStimChange();
}

function onStimChange() {
    if (sceneLoaded && modelOptions.stimulation != lastStimulation) {
        load_model();
    }
}

update_placements();
guiSelection.open();

const viewOptions = {
    orthographic: false,
    crossSection: true,
    background: "#ffffff",
    elecColor: "#c2ffc6",
    elecAlpha: 0.2,
    epiColor: "#b1e0ff",
    epiAlpha: 0.1,
    fascColor: "#ffffff",
    fascAlpha: 0.3,
    showFibers: true,
    percFibers: 5,    // = displayed / total * 100%
    get plotRatio() { return 100/this.percFibers; } 
};

function onViewChange() {
    scene.background = new THREE.Color(viewOptions.background);
}

function setColorByName(name, color, multiple) {
    multiple = true;
    if (multiple)
        scene.traverse(function (child) {
            if (child.name == name) {
                child.material.color.setStyle(color);
                console.log(child.name);
            }
        });
    else
        scene.getObjectByName(name)?.material.color.setStyle(color);
}

function setAlphaByName(name, alpha, multiple) {
    multiple = true;
    if (multiple)
        scene.traverse(function (child) {
            if (child.name == name) {
                child.material.opacity = alpha;
                child.visible = alpha > 0.05;
            }
        });
    else {
        // For some reason it doesn't work
        const o = scene.getObjectByName(name);
        if (o != null) {
            o.material.opacity = viewOptions.epiAlpha;
            o.visible = alpha > 0.05;
        }
    }
}

function show_fibers() {
    scene.traverse(function (child) {
        if (child.name == 'Fiber') {
            child.visible = viewOptions.showFibers;
        }
    });
}

const guiView = gui.addFolder('View');
guiView.add(viewOptions, 'orthographic').name('Orthographic');
guiView.add(viewOptions, 'crossSection').name('Cross Section').onFinishChange(set_clipping);
guiView.addColor(viewOptions, 'background').name('Background').onFinishChange(onViewChange);
guiView.addColor(viewOptions, 'elecColor').name('Electrode').onFinishChange(() => setColorByName("Electrode", viewOptions.elecColor, true));
guiView.add(viewOptions, 'elecAlpha', 0, 1).name('-> Opacity').onFinishChange(() => setAlphaByName("Electrode", viewOptions.elecAlpha, true));
guiView.addColor(viewOptions, 'epiColor').name('Epineurium').onFinishChange(() => setColorByName("Epineurium", viewOptions.epiColor, false));
guiView.add(viewOptions, 'epiAlpha', 0, 1).name('-> Opacity').onFinishChange(() => setAlphaByName("Epineurium", viewOptions.epiAlpha, false));
guiView.addColor(viewOptions, 'fascColor').name('Fascicles').onFinishChange(() => setColorByName("Fascicle", viewOptions.fascColor, true));
guiView.add(viewOptions, 'fascAlpha', 0, 1).name('-> Opacity').onFinishChange(() => setAlphaByName("Fascicle", viewOptions.fascAlpha, true));
guiView.add(viewOptions, 'showFibers').name('Show Fibers').onFinishChange(show_fibers);
guiView.add(viewOptions, 'percFibers', 0, 100).name('Displayed fibers %').onFinishChange(load_model);
guiView.open();

onViewChange();

// Scene setup
const d = 75;
const aspect = window.innerWidth / window.innerHeight;
const s = d;
const orthoCamera = new THREE.OrthographicCamera(-window.innerWidth / s, window.innerWidth / s, window.innerHeight / s, -window.innerHeight / s, 0.1, 1000);
const perspectiveCamera = new THREE.PerspectiveCamera(d, aspect, 0.1, 1000);

//const aspect = window.innerWidth / window.innerHeight
//const camera = new THREE.OrthographicCamera( - d * aspect, d * aspect, d, - d, 1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.sortObjects = false;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const perspectiveControls = new OrbitControls(orthoCamera, renderer.domElement);
const orthoControls = new OrbitControls(perspectiveCamera, renderer.domElement);

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    let aspect = window.innerWidth / window.innerHeight;
    perspectiveCamera.aspect = aspect;
    orthoCamera.left = -window.innerWidth / s;
    orthoCamera.right = window.innerWidth / s;
    orthoCamera.top = window.innerHeight / s;
    orthoCamera.bottom = -window.innerHeight / s;
    // TODO update also orthoCamera
    orthoCamera.updateProjectionMatrix()
    perspectiveCamera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
}

function onThresholdsLoaded(fibersets, fiberSetColors, thresholds) {
    console.log('All thresholds loaded.');
    plot_recruitment(fibersets, fiberSetColors, thresholds);
}

async function load_model() {
    lastStimulation = modelOptions.stimulation;
    await model.init();
    // TODO check if memory leaks
    scene.children.filter(x => x instanceof THREE.Mesh || x instanceof THREE.Line).forEach(x => scene.remove(x));
    nerve_loader.model = model;
    nerve_loader.modelOptions = modelOptions;
    nerve_loader.viewOptions = viewOptions;
    nerve_loader.load_nerve();
}

load_model();
sceneLoaded = true;

orthoCamera.position.z = 30;
perspectiveCamera.position.z = 30;
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 0.6);
//const hemiLight = new THREE.HemisphereLight(0x555555, 0xffffff, 0.6);
scene.add(hemiLight);
//const light = new THREE.AmbientLight(0xFFFFFF*0.6); // soft white light
//scene.add( light );

function animate() {
    requestAnimationFrame(animate);
    perspectiveControls.update();  // required if controls.enableDamping or controls.autoRotate are set to true
    orthoControls.update();
    if (viewOptions.orthographic) {
        renderer.render(scene, orthoCamera)
    }
    else {
        renderer.render(scene, perspectiveCamera)
    }
};

animate();

function onEpiLoaded(mesh) {
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getCenter(epiCenter);
    if (centerCamera) {
        perspectiveControls.target.copy(epiCenter);
        orthoControls.target.copy(epiCenter);
        centerCamera = false;
    };
    set_clipping();
}

function onAsLoaded(mesh) {
    return;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getCenter(asCenter);
    if (centerCamera) {
        perspectiveControls.target.copy(asCenter);
        orthoControls.target.copy(asCenter);
        centerCamera = false;
    };
    set_clipping();
}

function set_clipping() {
    if (viewOptions.crossSection) {
        //const crossSectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), asCenter.z);
        //const crossSectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), asCenter.z);
        const crossSectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), epiCenter.z);
        renderer.clippingPlanes = [crossSectionPlane];
    } else {
        renderer.clippingPlanes = [];
    }
}

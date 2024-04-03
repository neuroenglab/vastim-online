//import { linspace } from linspace
//import linspace from 'ndarray-linspace'
//import { matrix, min, max, range } from 'mathjs'
import { create, all } from './_snowpack/pkg/mathjs.js'
import 'https://cdn.plot.ly/plotly-2.6.3.min.js';

const math = create(all, {})

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        Plotly.Plots.resize(entry.target);
    }
});

export function plot_recruitment(fibersets, fiberSetColors, thresholds) {
    console.log(thresholds.map(max_thr));
    const maxThr = math.max(thresholds.map((thr) => max_thr(Array.from(thr.data))));
    console.log(maxThr);
    const lines = fibersets.map((fiberset, i) => {
        const [Q, recruitment] = compute_recruitment(Array.from(thresholds[i].data), maxThr);
        const line = {
            name: fiberset,
            x: Q.toArray(),
            y: recruitment,
            type: 'scatter',
            line: {
                color: fiberSetColors[i]
            }
        };
        return line;
    });
    const layout = {
        title: { text: 'Recruitment' },
        xaxis: { title: { text: 'Threshold [\u03BB]' } },
        yaxis: { title: { text: 'Number of fibers' } }
    };
    Plotly.newPlot('divRecruitment', lines, layout, {
        modeBarButtonsToAdd: [{
            name: 'toImage2',
            icon: Plotly.Icons.camera,
            click: function (gd) {
                Plotly.downloadImage(gd, { format: 'svg' })
            }
        }]
    }).then(function (gd) {
        resizeObserver.observe(gd);
    });;
}

function compute_recruitment(thresholds, maxThr) {
    if (thresholds.length > 0) {
        //console.log(thresholds);
        const minThr = math.min(thresholds);
        //const maxThr = math.max(thresholds);
        const Q = math.range(minThr, maxThr, (maxThr - minThr) / 100, true);
        //console.log(Q);
        const recruitment = Array.from(Q.toArray(), x => thresholds.filter(t => t <= x).length);
        return [Q, recruitment]
    } else return [math.matrix([]), []];
}

function max_thr(thresholds) {
    console.log(thresholds)
    if (thresholds.length > 0) {
        const maxThr = math.max(thresholds);
        return maxThr;
    } else return 0;
}

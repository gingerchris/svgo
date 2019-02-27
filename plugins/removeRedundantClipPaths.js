"use strict";
const path2js = require("./_path").path2js;

exports.type = "full";

exports.active = true;

exports.description =
    "removes clipPaths only applied to elements already contained within the bounds of the clipPath";

function getPointsFromInstructions(instructions) {
    return instructions.reduce((all, instruction) => {
        const { instruction: marker, data: values } = instruction;
        let points = all.length
            ? [all[all.length - 1][0], all[all.length - 1][1]]
            : [];
        switch (marker) {
            case "M":
            case "L": {
                points = values;
                break;
            }
            case "m":
            case "l": {
                points[0] += values[0];
                points[1] += values[1];
                break;
            }
            case "V": {
                points[1] = values[0];
                break;
            }
            case "v": {
                points[1] += values[0];
                break;
            }
            case "H": {
                points[0] = values[0];
                break;
            }
            case "h": {
                points[0] += values[0];
                break;
            }
            case "z":
            case "Z": {
                return all;
            }
            default: {
            }
        }
        all.push(points);
        return all;
    }, []);
}

function doPointsFormRectangle(points) {
    if (points.length !== 4) {
        return false;
    }
    const cx =
        points.reduce((all, one) => {
            return (all += one[0]);
        }, 0) / 4;
    const cy =
        points.reduce((all, one) => {
            return (all += one[1]);
        }, 0) / 4;

    const distances = points.map(([x, y]) => {
        const h = cx - x;
        const w = cy - y;
        return h * h + w * w;
    });

    return new Set(distances).size === 1;
}

function getPointsFromSquarePath(path) {
    const instructions = path2js(path);
    const allowedCommands = ["m", "M", "h", "H", "v", "V", "l", "L", "z", "Z"];
    if (
        !instructions.every(
            ({ marker }) => allowedCommands.indexOf(marker) > -1
        )
    ) {
        // this path contains non-linear commands - not a rectangle
        return false;
    }
    const points = getPointsFromInstructions(instructions);
    return doPointsFormRectangle(points) ? points : false;
}

function elementBoundsInsidePoints(element, points) {
    console.log(element);
}

/**
 *
 * @param {*} clipPath
 */
function processClipPath(clipPath, document) {
    const appliedElements = findNodes(
        document,
        node =>
            node.attrs &&
            node.attrs["clip-path"] &&
            node.attrs["clip-path"].value === `url(#${clipPath.attrs.id.value})`
    );
    if (!appliedElements.length) {
        // the clip path is unused, remove it
    }

    const pathChildren = clipPath.querySelectorAll("path");
    if (!pathChildren || pathChildren.length != 1) {
        // this can currently only deal with clip-paths containing a single path element
        return false;
    }
    const path = pathChildren[0];
    const points = getPointsFromSquarePath(path);

    const canRemoveClipPath = appliedElements.every(el =>
        elementBoundsInsidePoints(el, points)
    );
}

function findNodes(tree, matchFn) {
    let matches = [];
    if (matchFn(tree)) matches.push(tree);
    if (tree.content) {
        tree.content.forEach(node => {
            const innerMatches = findNodes(node, matchFn);
            matches = [...matches, ...innerMatches];
        });
    }
    return matches;
}

/**
 * Remove any rectangular clipPaths that do not have any visual impact
 */
exports.fn = function(data) {
    const clipPaths = data.querySelectorAll("clipPath");
    clipPaths.forEach(cp => processClipPath(cp, data));
    return data;
};
